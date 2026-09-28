/**
 * Seed dos dados OFICIAIS (empresa, perfis, usuários iniciais, termos, serviços, produtos).
 * Idempotente: pode rodar várias vezes sem duplicar nem sobrescrever o que a empresa já editou.
 * Nenhum dado fictício é criado aqui (dados de demonstração ficam em `demo.ts`).
 */
import { and, eq, sql } from 'drizzle-orm';
import { ALL_PERMISSIONS, DEFAULT_ROLES } from '../../../config/permissions';
import { DEFAULT_EXPENSE_CATEGORIES, OFFICIAL_COMPANY, OFFICIAL_USERS } from '../../../config/company-defaults';
import { OFFICIAL_PRODUCTS, OFFICIAL_SERVICES } from '../../../config/official-catalog';
import {
  DEFAULT_TERMS_CONTENT,
  DEFAULT_TERMS_TITLE,
  DEFAULT_WARRANTY_MONTHS,
} from '../../../config/guarantee-terms-default';
import { formatProductCode } from '../../../lib/codes';
import { generateTemporaryPassword, hashPassword } from '../../auth/password';
import { productSearchText, serviceSearchText } from '../../services/search-text';
import { getDb, runWrite } from '../client';
import * as s from '../schema';

export interface SeededUser {
  name: string;
  username: string;
  roleName: string;
  temporaryPassword: string;
}

export interface OfficialSeedResult {
  createdUsers: SeededUser[];
}

export async function seedOfficialData(): Promise<OfficialSeedResult> {
  const db = getDb();

  // Senhas: gera e calcula o hash ANTES da transação (scrypt é pesado e não deve segurar a fila de escrita).
  const existingUsernames = new Set((await db.select({ username: s.users.username }).from(s.users)).map((u) => u.username));
  const toCreate = await Promise.all(
    OFFICIAL_USERS.filter((u) => !existingUsernames.has(u.username)).map(async (u) => {
      const temporaryPassword = generateTemporaryPassword();
      return { ...u, temporaryPassword, passwordHash: await hashPassword(temporaryPassword) };
    }),
  );

  const createdUsers: SeededUser[] = [];

  await runWrite(async (tx) => {
    // 1) Perfis. O administrador sempre recebe TODAS as permissões (inclusive as adicionadas em atualizações).
    for (const role of DEFAULT_ROLES) {
      const [existing] = await tx.select().from(s.roles).where(eq(s.roles.key, role.key)).limit(1);
      if (!existing) {
        await tx.insert(s.roles).values({
          key: role.key,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          permissions: role.permissions,
        });
      } else if (role.key === 'admin') {
        await tx.update(s.roles).set({ permissions: ALL_PERMISSIONS }).where(eq(s.roles.id, existing.id));
      }
    }

    // 2) Configurações da empresa (linha única; nunca sobrescreve edições).
    await tx
      .insert(s.companySettings)
      .values({
        id: 1,
        name: OFFICIAL_COMPANY.name,
        cnpj: OFFICIAL_COMPANY.cnpj,
        email: OFFICIAL_COMPANY.email,
        whatsapp: OFFICIAL_COMPANY.whatsapp,
        phone: OFFICIAL_COMPANY.phone,
        address: OFFICIAL_COMPANY.address,
        city: OFFICIAL_COMPANY.city,
        state: OFFICIAL_COMPANY.state,
        instagram: OFFICIAL_COMPANY.instagram,
        hours: OFFICIAL_COMPANY.hours,
        paymentMethods: [...OFFICIAL_COMPANY.paymentMethods],
        seoTitle: OFFICIAL_COMPANY.seoTitle,
        seoDescription: OFFICIAL_COMPANY.seoDescription,
        timezone: OFFICIAL_COMPANY.timezone,
        whatsappTemplates: OFFICIAL_COMPANY.whatsappTemplates,
      })
      .onConflictDoNothing();

    // 3) Termos de garantia (versão 1, texto fornecido pelo cliente).
    const [{ count: termsCount }] = await tx.select({ count: sql<number>`count(*)` }).from(s.guaranteeTerms);
    if (Number(termsCount) === 0) {
      await tx.insert(s.guaranteeTerms).values({
        version: 1,
        title: DEFAULT_TERMS_TITLE,
        warrantyMonths: DEFAULT_WARRANTY_MONTHS,
        content: DEFAULT_TERMS_CONTENT,
        isActive: true,
      });
    }

    // 4) Categorias de custo.
    for (const [index, category] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
      await tx
        .insert(s.expenseCategories)
        .values({ name: category.name, isGoods: category.isGoods, sortOrder: index })
        .onConflictDoNothing();
    }

    // 5) Serviços oficiais (sem preço: "a combinar").
    for (const [index, service] of OFFICIAL_SERVICES.entries()) {
      await tx
        .insert(s.services)
        .values({
          name: service.name,
          category: service.category,
          sortOrder: index,
          searchText: serviceSearchText(service),
        })
        .onConflictDoNothing();
    }

    // 6) Produtos oficiais (sem preço/estoque: cadastrados depois pela empresa).
    for (const [index, product] of OFFICIAL_PRODUCTS.entries()) {
      const code = formatProductCode(index + 1);
      await tx
        .insert(s.products)
        .values({
          name: product.name,
          code,
          category: 'Componentes',
          iconKey: product.iconKey,
          sortOrder: index,
          searchText: productSearchText({ name: product.name, code, category: 'Componentes' }),
        })
        .onConflictDoNothing();
    }

    // 7) Usuários iniciais.
    for (const user of toCreate) {
      const [role] = await tx
        .select()
        .from(s.roles)
        .where(and(eq(s.roles.key, user.roleKey)))
        .limit(1);
      if (!role) continue;
      await tx.insert(s.users).values({
        name: user.name,
        username: user.username,
        passwordHash: user.passwordHash,
        roleId: role.id,
        isActive: true,
        mustChangePassword: true,
      });
      createdUsers.push({
        name: user.name,
        username: user.username,
        roleName: role.name,
        temporaryPassword: user.temporaryPassword,
      });
    }
  });

  return { createdUsers };
}
