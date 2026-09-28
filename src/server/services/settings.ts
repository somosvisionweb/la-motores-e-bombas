import { desc, eq } from 'drizzle-orm';
import type { BusinessHours, WhatsAppTemplates } from '@/config/company';
import type { PaymentMethod } from '@/config/payment-methods';
import type { CompanyProfileInput, GuaranteeTermsInput } from '@/lib/validation/settings';
import { BusinessError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, runWrite } from '../db/client';
import { companySettings, guaranteeTerms, type CompanySettings, type GuaranteeTerms } from '../db/schema';
import { audit } from './audit';

export async function getCompanySettings(): Promise<CompanySettings> {
  const [row] = await getDb().select().from(companySettings).where(eq(companySettings.id, 1)).limit(1);
  if (!row) throw new BusinessError('Configurações da empresa não encontradas. Execute "npm run db:seed".');
  return row;
}

/** URL pública do sistema/site (usada em links de PDF e SEO). */
export function getPublicBaseUrl(company: Pick<CompanySettings, 'publicBaseUrl'>): string {
  const url = company.publicBaseUrl || process.env.APP_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

/** Links públicos só funcionam para o cliente se o sistema estiver publicado na internet. */
export function isLocalBaseUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/i.test(url);
}

async function patchSettings(patch: Partial<typeof companySettings.$inferInsert>, actor: Actor, summary: string) {
  await runWrite(async (tx) => {
    await tx
      .update(companySettings)
      .set({ ...patch, updatedBy: actor.id })
      .where(eq(companySettings.id, 1));
    await audit({ actor, action: 'SETTINGS_UPDATE', entityType: 'company_settings', entityId: 1, summary });
  });
}

export async function updateCompanyProfile(input: CompanyProfileInput, actor: Actor): Promise<void> {
  await patchSettings(
    {
      name: input.name,
      cnpj: input.cnpj,
      email: input.email,
      whatsapp: input.whatsapp,
      phone: input.phone,
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
      instagram: input.instagram,
      publicBaseUrl: input.publicBaseUrl,
    },
    actor,
    'Dados da empresa atualizados',
  );
}

export async function updateBusinessHours(hours: BusinessHours, actor: Actor): Promise<void> {
  await patchSettings({ hours }, actor, 'Horário de atendimento atualizado');
}

export async function updatePaymentMethods(methods: PaymentMethod[], actor: Actor): Promise<void> {
  await patchSettings({ paymentMethods: methods }, actor, 'Formas de pagamento atualizadas');
}

export async function updateWhatsAppTemplates(templates: WhatsAppTemplates, actor: Actor): Promise<void> {
  await patchSettings({ whatsappTemplates: templates }, actor, 'Mensagens de WhatsApp atualizadas');
}

export async function updateSeo(input: { seoTitle: string; seoDescription: string }, actor: Actor): Promise<void> {
  await patchSettings({ seoTitle: input.seoTitle, seoDescription: input.seoDescription }, actor, 'SEO do site atualizado');
}

/** Política de privacidade do site (/privacidade). Texto vazio a remove: a página some e o link do rodapé também. */
export async function updatePrivacyPolicy(text: string | null, actor: Actor): Promise<void> {
  const value = (text ?? '').replace(/\r\n?/g, '\n').trim();
  await patchSettings({ privacyText: value || null }, actor, value ? 'Política de privacidade atualizada' : 'Política de privacidade removida');
}

// ---------- Termos de garantia (versionados) ----------

export async function getActiveGuaranteeTerms(): Promise<GuaranteeTerms> {
  const [row] = await getDb()
    .select()
    .from(guaranteeTerms)
    .where(eq(guaranteeTerms.isActive, true))
    .orderBy(desc(guaranteeTerms.version))
    .limit(1);
  if (!row) throw new BusinessError('Termos de garantia não encontrados. Execute "npm run db:seed".');
  return row;
}

export async function getGuaranteeTermsById(id: number): Promise<GuaranteeTerms | null> {
  const [row] = await getDb().select().from(guaranteeTerms).where(eq(guaranteeTerms.id, id)).limit(1);
  return row ?? null;
}

export async function listGuaranteeTermsVersions(): Promise<GuaranteeTerms[]> {
  return getDb().select().from(guaranteeTerms).orderBy(desc(guaranteeTerms.version));
}

/** Salvar cria uma NOVA versão ativa e preserva as anteriores (documentos antigos mantêm o texto da época). */
export async function saveGuaranteeTerms(input: GuaranteeTermsInput, actor: Actor): Promise<GuaranteeTerms> {
  return runWrite(async (tx) => {
    const [current] = await tx
      .select()
      .from(guaranteeTerms)
      .where(eq(guaranteeTerms.isActive, true))
      .orderBy(desc(guaranteeTerms.version))
      .limit(1);

    if (
      current &&
      current.title === input.title &&
      current.content === input.content &&
      current.warrantyMonths === input.warrantyMonths
    ) {
      return current;
    }

    const [latest] = await tx.select().from(guaranteeTerms).orderBy(desc(guaranteeTerms.version)).limit(1);
    await tx.update(guaranteeTerms).set({ isActive: false }).where(eq(guaranteeTerms.isActive, true));
    const [created] = await tx
      .insert(guaranteeTerms)
      .values({
        version: (latest?.version ?? 0) + 1,
        title: input.title,
        warrantyMonths: input.warrantyMonths,
        content: input.content,
        isActive: true,
        createdBy: actor.id,
      })
      .returning();
    await audit({
      actor,
      action: 'TERMS_UPDATE',
      entityType: 'guarantee_terms',
      entityId: created!.id,
      summary: `Termos de garantia — nova versão ${created!.version}`,
    });
    return created!;
  });
}
