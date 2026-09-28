'use server';

import { PermissionError } from '@/server/auth/errors';
import { requireActionPermission } from '@/server/auth/session';
import { toActor } from '@/server/auth/types';
import { getOrCreateShareToken, type DocumentLinkType } from '@/server/services/document-links';
import { getOrder, recordOrderDocumentEvent } from '@/server/services/orders';
import { getCompanySettings, getPublicBaseUrl } from '@/server/services/settings';

const TYPES: DocumentLinkType[] = ['ORDER', 'SALE', 'RECEIPT'];

const NEEDED = {
  ORDER: 'orders.view',
  SALE: 'sales.view',
  RECEIPT: 'payments.view',
} as const;

/** Gera (ou reaproveita) o link público do PDF para enviar ao cliente. */
export async function createShareLinkAction(type: DocumentLinkType, refId: number): Promise<{ ok: boolean; url?: string; message?: string }> {
  try {
    if (!TYPES.includes(type) || !Number.isInteger(refId)) return { ok: false, message: 'Documento inválido.' };
    const user = await requireActionPermission('documents.print', NEEDED[type]);
    const token = await getOrCreateShareToken(type, refId, toActor(user));
    const company = await getCompanySettings();
    return { ok: true, url: `${getPublicBaseUrl(company)}/d/${token}` };
  } catch (error) {
    if (error instanceof PermissionError) return { ok: false, message: error.message };
    console.error('[documents] falha ao criar link:', error);
    return { ok: false, message: 'Não foi possível gerar o link do documento.' };
  }
}

/** Registra no histórico da OS que o documento foi enviado ao cliente pelo WhatsApp. */
export async function logDocumentSentAction(type: DocumentLinkType, refId: number, withLink: boolean): Promise<void> {
  try {
    const user = await requireActionPermission('documents.print', NEEDED[type]);
    if (type === 'ORDER' && (await getOrder(refId))) {
      await recordOrderDocumentEvent(refId, `Envio ao cliente pelo WhatsApp iniciado${withLink ? ' (com link do PDF)' : ''}.`, toActor(user));
    }
  } catch {
    /* o registro no histórico é opcional: nunca deve impedir o envio */
  }
}
