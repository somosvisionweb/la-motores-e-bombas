'use server';

import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/lib/action-state';
import { idField } from '@/lib/validation/common';
import { companyProfileSchema, guaranteeTermsSchema, parseBusinessHours, paymentMethodsSchema, privacyPolicySchema, seoSchema, whatsappTemplatesSchema } from '@/lib/validation/settings';
import { BusinessError } from '@/server/auth/errors';
import { requireActionPermission } from '@/server/auth/session';
import { toActor } from '@/server/auth/types';
import { seedDemoData } from '@/server/db/seed/demo';
import { clearDemoData } from '@/server/services/demo';
import { addSiteImage, deleteSiteImage, removeCompanyLogo, setCompanyLogo, updateSiteImageAlt } from '@/server/services/files';
import {
  saveGuaranteeTerms,
  updateBusinessHours,
  updateCompanyProfile,
  updatePaymentMethods,
  updatePrivacyPolicy,
  updateSeo,
  updateWhatsAppTemplates,
} from '@/server/services/settings';
import { invalidateSiteCache } from '@/server/services/site';
import { formToObject, runAction, validationFailure } from './_helpers';

function refresh() {
  invalidateSiteCache();
  revalidatePath('/sistema', 'layout');
}

async function readImage(formData: FormData, field: string): Promise<{ buffer: Buffer; name: string }> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) throw new BusinessError('Selecione um arquivo de imagem.', field);
  return { buffer: Buffer.from(await file.arrayBuffer()), name: file.name };
}

export async function updateCompanyProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const parsed = companyProfileSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await updateCompanyProfile(parsed.data, toActor(user));
    refresh();
    return { ok: true, message: 'Dados da empresa salvos. Site, documentos e PDFs já usam as novas informações.' };
  });
}

export async function updateBusinessHoursAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const parsed = parseBusinessHours(formToObject(formData));
    if (!parsed.hours) return { ok: false, message: 'Corrija os horários destacados.', fieldErrors: parsed.errors, values: Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string> };
    await updateBusinessHours(parsed.hours, toActor(user));
    refresh();
    return { ok: true, message: 'Horário de atendimento salvo.' };
  });
}

export async function updatePaymentMethodsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const parsed = paymentMethodsSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await updatePaymentMethods(parsed.data.paymentMethods, toActor(user));
    refresh();
    return { ok: true, message: 'Formas de pagamento salvas.' };
  });
}

export async function updateWhatsAppTemplatesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const parsed = whatsappTemplatesSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await updateWhatsAppTemplates(parsed.data, toActor(user));
    refresh();
    return { ok: true, message: 'Mensagens de WhatsApp salvas.' };
  });
}

export async function updateSeoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const parsed = seoSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await updateSeo(parsed.data, toActor(user));
    refresh();
    return { ok: true, message: 'Título e descrição do site salvos.' };
  });
}

export async function updatePrivacyPolicyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const parsed = privacyPolicySchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await updatePrivacyPolicy(parsed.data.privacyText, toActor(user));
    refresh();
    return {
      ok: true,
      message: parsed.data.privacyText ? 'Política de privacidade salva. Ela já aparece no rodapé e no endereço /privacidade do site.' : 'Política de privacidade removida do site.',
    };
  });
}

export async function saveGuaranteeTermsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const parsed = guaranteeTermsSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const terms = await saveGuaranteeTerms(parsed.data, toActor(user));
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: `Termos de garantia salvos (versão ${terms.version}). Novos documentos já usam este texto.` };
  });
}

export async function uploadLogoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const image = await readImage(formData, 'logo');
    await setCompanyLogo(image.buffer, image.name, toActor(user));
    refresh();
    return { ok: true, message: 'Logo atualizada. Ela já aparece no site, no sistema, nos documentos e nos PDFs.' };
  });
}

export async function removeLogoAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    await removeCompanyLogo(toActor(user));
    refresh();
    return { ok: true, message: 'Logo removida. A marca tipográfica provisória voltou a ser usada.' };
  });
}

export async function addSiteImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const slot = formData.get('slot') === 'HERO' ? 'HERO' : 'GALLERY';
    const image = await readImage(formData, 'image');
    const alt = String(formData.get('alt') ?? '').trim();
    if (!alt) return { ok: false, message: 'Descreva a imagem (texto alternativo) para acessibilidade e SEO.', fieldErrors: { alt: 'Descreva a imagem.' } };
    await addSiteImage({ buffer: image.buffer, fileName: image.name, slot, alt }, toActor(user));
    refresh();
    return { ok: true, message: slot === 'HERO' ? 'Imagem principal do site atualizada.' : 'Imagem adicionada à galeria do site.' };
  });
}

export async function updateSiteImageAltAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const id = idField('Imagem').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Imagem inválida.' };
    await updateSiteImageAlt(id.data, String(formData.get('alt') ?? ''), toActor(user));
    refresh();
    return { ok: true, message: 'Descrição da imagem salva.' };
  });
}

export async function deleteSiteImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const id = idField('Imagem').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Imagem inválida.' };
    await deleteSiteImage(id.data, toActor(user));
    refresh();
    return { ok: true, message: 'Imagem removida do site.' };
  });
}

export async function clearDemoDataAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await requireActionPermission('settings.manage');
    const removed = await clearDemoData();
    refresh();
    const total = removed.customers + removed.orders + removed.sales + removed.payments + removed.expenses + removed.storeOrders;
    return { ok: true, message: `Dados de demonstração removidos (${total} registros).${removed.keptCustomers ? ` ${removed.keptCustomers} cliente(s) mantido(s) por terem ordens reais.` : ''}` };
  });
}

export async function loadDemoDataAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await requireActionPermission('settings.manage');
    const result = await seedDemoData();
    refresh();
    return { ok: true, message: `Dados de demonstração criados: ${result.customers} clientes, ${result.orders} ordens, ${result.sales} vendas e ${result.storeOrders} pedidos da loja.` };
  });
}
