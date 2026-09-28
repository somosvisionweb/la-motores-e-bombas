import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ALL_PERMISSIONS } from '@/config/permissions';
import { BusinessError } from '@/server/auth/errors';
import { verifyPassword } from '@/server/auth/password';
import { checkLoginThrottle, recordLoginAttempt } from '@/server/auth/throttle';
import type { Actor } from '@/server/auth/types';
import { getDb } from '@/server/db/client';
import { auditLogs, sessions, users } from '@/server/db/schema';
import { createUser, deleteRole, getRoleByKey, resetUserPassword, saveRole, updateUser } from '@/server/services/users';
import { setupTestDb, teardownTestDb } from '../helpers/db';

let actor: Actor;
let adminId: number;
let sellerRoleId: number;
let adminRoleId: number;

beforeAll(async () => {
  ({ actor } = await setupTestDb('users-auth'));
  adminId = actor.id;
  sellerRoleId = (await getRoleByKey('seller'))!.id;
  adminRoleId = (await getRoleByKey('admin'))!.id;
});

afterAll(() => teardownTestDb());

async function userRow(id: number) {
  const [row] = await getDb().select().from(users).where(eq(users.id, id));
  return row!;
}

describe('usuários', () => {
  it('cria com senha temporária: só o hash é gravado e a troca é obrigatória', async () => {
    const { user, temporaryPassword } = await createUser({ name: 'Ana Teste', username: 'ana.teste', email: 'ana@exemplo.com.br', roleId: sellerRoleId, isActive: true }, actor);
    const row = await userRow(user.id);
    expect(row.passwordHash).not.toContain(temporaryPassword);
    expect(await verifyPassword(temporaryPassword, row.passwordHash)).toBe(true);
    expect(row.mustChangePassword).toBe(true);
    const logs = await getDb().select().from(auditLogs).where(eq(auditLogs.action, 'USER_CREATE'));
    expect(JSON.stringify(logs)).not.toContain(temporaryPassword);
  });

  it('não permite login duplicado nem perfil inexistente', async () => {
    await expect(createUser({ name: 'Outra Ana', username: 'ana.teste', email: null, roleId: sellerRoleId, isActive: true }, actor)).rejects.toThrow(/nome de usuário/);
    await expect(createUser({ name: 'Sem Perfil', username: 'sem.perfil', email: null, roleId: 9999, isActive: true }, actor)).rejects.toBeInstanceOf(BusinessError);
  });

  it('redefinir a senha gera outra senha temporária e encerra as sessões abertas', async () => {
    const { user, temporaryPassword } = await createUser({ name: 'Bia Teste', username: 'bia.teste', email: null, roleId: sellerRoleId, isActive: true }, actor);
    await getDb().insert(sessions).values({ id: 'sessao-teste-1', userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) });
    const fresh = await resetUserPassword(user.id, actor);
    expect(fresh).not.toBe(temporaryPassword);
    const row = await userRow(user.id);
    expect(await verifyPassword(fresh, row.passwordHash)).toBe(true);
    expect(await verifyPassword(temporaryPassword, row.passwordHash)).toBe(false);
    expect(row.mustChangePassword).toBe(true);
    const left = await getDb().select().from(sessions).where(eq(sessions.userId, user.id));
    expect(left).toHaveLength(0);
  });

  it('desativar o usuário encerra as sessões; não pode desativar a si mesmo', async () => {
    const { user } = await createUser({ name: 'Caio Teste', username: 'caio.teste', email: null, roleId: sellerRoleId, isActive: true }, actor);
    await getDb().insert(sessions).values({ id: 'sessao-teste-2', userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) });
    await updateUser(user.id, { name: 'Caio Teste', email: null, roleId: sellerRoleId, isActive: false }, actor);
    expect(await getDb().select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
    await expect(updateUser(adminId, { name: 'Ewerton Nunes', email: null, roleId: adminRoleId, isActive: false }, actor)).rejects.toThrow(/ao menos um administrador|próprio usuário/);
  });

  it('sempre mantém ao menos um administrador ativo', async () => {
    // o único administrador não pode perder o perfil de administrador
    await expect(updateUser(adminId, { name: 'Ewerton Nunes', email: null, roleId: sellerRoleId, isActive: true }, actor)).rejects.toThrow(/ao menos um administrador/);
    // com um segundo administrador, a troca é permitida
    const second = await createUser({ name: 'Segundo Admin', username: 'segundo.admin', email: null, roleId: adminRoleId, isActive: true }, actor);
    await updateUser(second.user.id, { name: 'Segundo Admin', email: null, roleId: sellerRoleId, isActive: true }, actor);
    expect((await userRow(second.user.id)).roleId).toBe(sellerRoleId);
  });
});

describe('perfis de acesso', () => {
  it('o perfil administrador sempre mantém todas as permissões, mesmo se tentarem reduzi-las', async () => {
    const saved = await saveRole({ id: adminRoleId, name: 'Administrador', description: null, permissions: ['orders.view'] }, actor);
    expect([...saved.permissions].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it('cria perfil personalizado com chave própria e não duplica o nome', async () => {
    const role = await saveRole({ name: 'Financeiro Júnior', description: 'Somente consulta', permissions: ['payments.view', 'expenses.view'] }, actor);
    expect(role.key).toBe('financeiro_junior');
    expect(role.isSystem).toBe(false);
    expect(role.permissions).toEqual(['payments.view', 'expenses.view']);
    await expect(saveRole({ name: 'Financeiro Júnior', description: null, permissions: [] }, actor)).rejects.toThrow(/perfil com este nome/);
  });

  it('perfis do sistema e perfis em uso não podem ser excluídos', async () => {
    await expect(deleteRole(sellerRoleId, actor)).rejects.toThrow(/sistema/);
    const role = await saveRole({ name: 'Perfil em uso', description: null, permissions: ['orders.view'] }, actor);
    await createUser({ name: 'Dani Teste', username: 'dani.teste', email: null, roleId: role.id, isActive: true }, actor);
    await expect(deleteRole(role.id, actor)).rejects.toThrow(/usuários com este perfil/);
    const empty = await saveRole({ name: 'Perfil vazio', description: null, permissions: [] }, actor);
    await deleteRole(empty.id, actor);
  });
});

describe('proteção contra tentativas de login em excesso', () => {
  it('bloqueia após 5 falhas do mesmo usuário e não afeta outros usuários', async () => {
    for (let i = 0; i < 4; i++) await recordLoginAttempt('alvo', '10.0.0.1', false);
    expect((await checkLoginThrottle('alvo', '10.0.0.1')).blocked).toBe(false);
    await recordLoginAttempt('alvo', '10.0.0.1', false);
    expect((await checkLoginThrottle('alvo', '10.0.0.1')).blocked).toBe(true);
    expect((await checkLoginThrottle('outro', null)).blocked).toBe(false);
  });

  it('um login bem-sucedido zera o contador do usuário', async () => {
    for (let i = 0; i < 4; i++) await recordLoginAttempt('quase', null, false);
    await recordLoginAttempt('quase', null, true);
    for (let i = 0; i < 4; i++) await recordLoginAttempt('quase', null, false);
    expect((await checkLoginThrottle('quase', null)).blocked).toBe(false);
  });

  it('bloqueia um IP com muitas falhas contra usuários diferentes', async () => {
    for (let i = 0; i < 30; i++) await recordLoginAttempt(`vitima${i}`, '203.0.113.9', false);
    expect((await checkLoginThrottle('qualquer', '203.0.113.9')).blocked).toBe(true);
    expect((await checkLoginThrottle('qualquer', '203.0.113.10')).blocked).toBe(false);
  });
});
