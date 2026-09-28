import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSION_GROUPS, isPermissionKey } from '@/config/permissions';
import { generateTemporaryPassword, hashPassword, validatePasswordStrength, verifyPassword } from '@/server/auth/password';
import { hasAnyPermission, hasPermission } from '@/server/auth/types';

describe('senhas', () => {
  it('guarda apenas o hash (scrypt com salt), nunca a senha', async () => {
    const hash = await hashPassword('Senha#Segura2026');
    expect(hash).not.toContain('Senha#Segura2026');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash.split('$')).toHaveLength(6);
  });

  it('a mesma senha gera hashes diferentes (salt aleatório) e ambos verificam', async () => {
    const [a, b] = await Promise.all([hashPassword('Mesma#Senha1'), hashPassword('Mesma#Senha1')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('Mesma#Senha1', a)).toBe(true);
    expect(await verifyPassword('Mesma#Senha1', b)).toBe(true);
  });

  it('rejeita senha errada e hashes adulterados ou com custo absurdo', async () => {
    const hash = await hashPassword('Correta#123');
    expect(await verifyPassword('correta#123', hash)).toBe(false);
    expect(await verifyPassword('Correta#123', 'texto-qualquer')).toBe(false);
    expect(await verifyPassword('Correta#123', 'scrypt$2$8$1$YWJj$ZGVm')).toBe(false);
    // N enorme (2^25) exigiria memória demais: precisa ser recusado sem calcular
    const parts = hash.split('$');
    parts[1] = String(2 ** 25);
    expect(await verifyPassword('Correta#123', parts.join('$'))).toBe(false);
  });

  it('valida a força da senha com mensagens em português', () => {
    expect(validatePasswordStrength('curta1')).toMatch(/8 caracteres/);
    expect(validatePasswordStrength('somenteletras')).toMatch(/letras e números/);
    expect(validatePasswordStrength('12345678')).toMatch(/letras e números/);
    expect(validatePasswordStrength('senha123')).toMatch(/previsível/);
    expect(validatePasswordStrength('ewerton2026', { username: 'ewerton' })).toMatch(/nome de usuário/);
    expect(validatePasswordStrength('Boa#Senha2026', { username: 'ewerton' })).toBeNull();
  });

  it('senha temporária legível, sem caracteres ambíguos e sem repetição', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/);
      seen.add(password);
    }
    expect(seen.size).toBe(200);
  });
});

describe('perfis e permissões', () => {
  it('todas as permissões do catálogo têm chave única e reconhecível', () => {
    const keys = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => isPermissionKey(key))).toBe(true);
    expect(isPermissionKey('nao.existe')).toBe(false);
  });

  it('administrador possui todas as permissões', () => {
    const admin = DEFAULT_ROLES.find((r) => r.key === 'admin')!;
    expect([...admin.permissions].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it('vendedor não acessa financeiro sensível, relatórios, usuários nem configurações', () => {
    const seller = DEFAULT_ROLES.find((r) => r.key === 'seller')!;
    const user = { permissions: seller.permissions };
    for (const blocked of ['finance.view', 'expenses.view', 'expenses.manage', 'payments.void', 'reports.view', 'reports.export', 'users.view', 'users.manage', 'settings.manage', 'customers.delete', 'orders.delete', 'products.manage', 'products.stock'] as const) {
      expect(hasPermission(user, blocked), blocked).toBe(false);
    }
    for (const allowed of ['customers.create', 'orders.create', 'orders.status', 'sales.create', 'payments.create', 'documents.print'] as const) {
      expect(hasPermission(user, allowed), allowed).toBe(true);
    }
  });

  it('usuário sem sessão/perfil nunca tem permissão', () => {
    expect(hasPermission(null, 'dashboard.view')).toBe(false);
    expect(hasPermission(undefined, 'dashboard.view')).toBe(false);
    expect(hasAnyPermission({ permissions: [] }, ['orders.view', 'sales.view'])).toBe(false);
    expect(hasAnyPermission({ permissions: ['sales.view'] }, ['orders.view', 'sales.view'])).toBe(true);
  });
});
