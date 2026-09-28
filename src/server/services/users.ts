import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { ALL_PERMISSIONS } from '@/config/permissions';
import type { RoleFormInput, UserFormInput } from '@/lib/validation/users';
import { BusinessError, NotFoundError } from '../auth/errors';
import { generateTemporaryPassword, hashPassword } from '../auth/password';
import type { Actor } from '../auth/types';
import { getDb, isUniqueViolation, runWrite } from '../db/client';
import { roles, sessions, users, type Role, type User } from '../db/schema';
import { audit } from './audit';

/** Usuários ativos que podem ser escolhidos como técnico responsável. */
export async function listTechnicianOptions(): Promise<{ id: number; name: string }[]> {
  return getDb().select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name));
}

export async function getRoleByKey(key: string) {
  const [row] = await getDb().select().from(roles).where(eq(roles.key, key)).limit(1);
  return row ?? null;
}

export interface UserRow {
  id: number;
  name: string;
  username: string;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  roleId: number;
  roleName: string;
  roleKey: string;
}

export async function listUsers(): Promise<UserRow[]> {
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      roleId: roles.id,
      roleName: roles.name,
      roleKey: roles.key,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .orderBy(asc(users.name));
}

export async function getUser(id: number): Promise<User | null> {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

async function activeAdminCount(exceptUserId?: number): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(roles.key, 'admin'), eq(users.isActive, true), exceptUserId ? ne(users.id, exceptUserId) : undefined));
  return Number(row?.n ?? 0);
}

/** Cria o usuário com senha temporária (exibida uma única vez; troca obrigatória no primeiro acesso). */
export async function createUser(input: UserFormInput, actor: Actor): Promise<{ user: User; temporaryPassword: string }> {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    const user = await runWrite(async (tx) => {
      const [role] = await tx.select().from(roles).where(eq(roles.id, input.roleId)).limit(1);
      if (!role) throw new BusinessError('Perfil de acesso não encontrado.', 'roleId');
      const [created] = await tx
        .insert(users)
        .values({ name: input.name, username: input.username, email: input.email, roleId: input.roleId, isActive: input.isActive, passwordHash, mustChangePassword: true })
        .returning();
      await audit({ actor, action: 'USER_CREATE', entityType: 'users', entityId: created!.id, summary: `Usuário criado: ${created!.username} (${role.name})` });
      return created!;
    });
    return { user, temporaryPassword };
  } catch (error) {
    throw translateUserError(error);
  }
}

function translateUserError(error: unknown): unknown {
  if (isUniqueViolation(error)) {
    const text = String((error as Error).message);
    if (/users\.email/i.test(text)) return new BusinessError('Já existe um usuário com este e-mail.', 'email');
    return new BusinessError('Já existe um usuário com este nome de usuário.', 'username');
  }
  return error;
}

export async function updateUser(id: number, input: Omit<UserFormInput, 'username'>, actor: Actor): Promise<User> {
  try {
    return await runWrite(async (tx) => {
      const [existing] = await tx.select().from(users).where(eq(users.id, id)).limit(1);
      if (!existing) throw new NotFoundError('Usuário');
      const [role] = await tx.select().from(roles).where(eq(roles.id, input.roleId)).limit(1);
      if (!role) throw new BusinessError('Perfil de acesso não encontrado.', 'roleId');
      const [currentRole] = await tx.select().from(roles).where(eq(roles.id, existing.roleId)).limit(1);

      const losingAdmin = currentRole?.key === 'admin' && existing.isActive && (role.key !== 'admin' || !input.isActive);
      if (losingAdmin && (await activeAdminCount(id)) === 0) {
        throw new BusinessError('É necessário manter ao menos um administrador ativo no sistema.');
      }
      if (id === actor.id && !input.isActive) throw new BusinessError('Você não pode desativar o próprio usuário.');

      const [updated] = await tx.update(users).set({ name: input.name, email: input.email, roleId: input.roleId, isActive: input.isActive }).where(eq(users.id, id)).returning();
      if (!input.isActive) await tx.delete(sessions).where(eq(sessions.userId, id)); // desativar encerra as sessões
      await audit({ actor, action: 'USER_UPDATE', entityType: 'users', entityId: id, summary: `Usuário atualizado: ${existing.username} (${role.name}${input.isActive ? '' : ', desativado'})` });
      return updated!;
    });
  } catch (error) {
    throw translateUserError(error);
  }
}

export async function resetUserPassword(id: number, actor: Actor): Promise<string> {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await runWrite(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) throw new NotFoundError('Usuário');
    await tx.update(users).set({ passwordHash, mustChangePassword: true, passwordChangedAt: new Date() }).where(eq(users.id, id));
    await tx.delete(sessions).where(eq(sessions.userId, id));
    await audit({ actor, action: 'USER_PASSWORD_RESET', entityType: 'users', entityId: id, summary: `Senha redefinida: ${existing.username}` });
  });
  return temporaryPassword;
}

// ---------- perfis de acesso ----------

export interface RoleRow extends Role {
  userCount: number;
}

export async function listRoles(): Promise<RoleRow[]> {
  const rows = await getDb()
    .select({ role: roles, userCount: sql<number>`(SELECT COUNT(*) FROM users u WHERE u.role_id = ${roles.id})` })
    .from(roles)
    .orderBy(asc(roles.id));
  return rows.map((r) => ({ ...r.role, userCount: Number(r.userCount) }));
}

export async function getRole(id: number): Promise<Role | null> {
  const [row] = await getDb().select().from(roles).where(eq(roles.id, id)).limit(1);
  return row ?? null;
}

function slugKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export async function saveRole(input: RoleFormInput & { id?: number }, actor: Actor): Promise<Role> {
  try {
    return await runWrite(async (tx) => {
      // Nomes de perfil não se repetem (comparação sem diferenciar maiúsculas/minúsculas).
      const sameName = await tx.select({ id: roles.id }).from(roles).where(sql`lower(${roles.name}) = lower(${input.name})`);
      if (sameName.some((row) => row.id !== input.id)) throw new BusinessError('Já existe um perfil com este nome.', 'name');
      if (input.id) {
        const [existing] = await tx.select().from(roles).where(eq(roles.id, input.id)).limit(1);
        if (!existing) throw new NotFoundError('Perfil');
        // O administrador sempre mantém todas as permissões.
        const permissions = existing.key === 'admin' ? ALL_PERMISSIONS : input.permissions;
        const [updated] = await tx.update(roles).set({ name: input.name, description: input.description, permissions }).where(eq(roles.id, input.id)).returning();
        await audit({ actor, action: 'ROLE_UPDATE', entityType: 'roles', entityId: input.id, summary: `Perfil atualizado: ${input.name}` });
        return updated!;
      }
      const base = slugKey(input.name) || 'perfil';
      let key = base;
      for (let i = 2; ; i++) {
        const [clash] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, key)).limit(1);
        if (!clash) break;
        key = `${base}_${i}`;
      }
      const [created] = await tx.insert(roles).values({ key, name: input.name, description: input.description, permissions: input.permissions, isSystem: false }).returning();
      await audit({ actor, action: 'ROLE_CREATE', entityType: 'roles', entityId: created!.id, summary: `Perfil criado: ${input.name}` });
      return created!;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new BusinessError('Já existe um perfil com este nome.', 'name');
    throw error;
  }
}

export async function deleteRole(id: number, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const [existing] = await tx.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!existing) throw new NotFoundError('Perfil');
    if (existing.isSystem) throw new BusinessError('Perfis do sistema não podem ser excluídos.');
    const [used] = await tx.select({ n: sql<number>`count(*)` }).from(users).where(eq(users.roleId, id));
    if (Number(used?.n) > 0) throw new BusinessError('Há usuários com este perfil. Troque o perfil deles antes de excluir.');
    await tx.delete(roles).where(eq(roles.id, id));
    await audit({ actor, action: 'ROLE_DELETE', entityType: 'roles', entityId: id, summary: `Perfil excluído: ${existing.name}` });
  });
}
