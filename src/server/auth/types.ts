import type { PermissionKey } from '@/config/permissions';

export interface SessionUser {
  id: number;
  name: string;
  username: string;
  roleId: number;
  roleKey: string;
  roleName: string;
  permissions: string[];
  mustChangePassword: boolean;
  sessionId: string;
  ip: string | null;
}

/** Quem executa a ação (gravado em histórico e auditoria). */
export interface Actor {
  id: number;
  name: string;
  ip?: string | null;
}

export type { PermissionKey };

export function hasPermission(user: Pick<SessionUser, 'permissions'> | null | undefined, permission: PermissionKey): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function hasAnyPermission(user: Pick<SessionUser, 'permissions'> | null | undefined, permissions: PermissionKey[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

export function toActor(user: SessionUser): Actor {
  return { id: user.id, name: user.name, ip: user.ip };
}
