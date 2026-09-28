import type { z } from 'zod';
import type { ActionState } from '@/lib/action-state';
import { fieldErrorsFrom, formValues } from '@/lib/validation/common';
import { BusinessError, PermissionError } from '@/server/auth/errors';

/** Erros de controle de fluxo do Next (redirect, notFound…) precisam ser relançados. */
function isNextControlFlow(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'digest' in error && String((error as { digest: unknown }).digest).startsWith('NEXT_');
}

/**
 * Executa o corpo de uma Server Action convertendo erros esperados (regra de negócio, permissão)
 * em mensagens amigáveis e escondendo detalhes de erros inesperados.
 */
export async function runAction<T = unknown>(fn: () => Promise<ActionState<T>>): Promise<ActionState<T>> {
  try {
    return await fn();
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    if (error instanceof PermissionError) return { ok: false, message: error.message };
    if (error instanceof BusinessError) {
      return { ok: false, message: error.message, fieldErrors: error.field ? { [error.field]: error.message } : undefined };
    }
    console.error('[action] erro inesperado:', error);
    return { ok: false, message: 'Ocorreu um erro inesperado. Tente novamente; se o problema continuar, avise o administrador.' };
  }
}

export function validationFailure(error: z.ZodError, formData: FormData): ActionState {
  return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: fieldErrorsFrom(error), values: formValues(formData) };
}

/** Converte FormData em objeto simples para validação (mantém somente strings/arquivos). */
export function formToObject(formData: FormData): Record<string, FormDataEntryValue | FormDataEntryValue[]> {
  const result: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith('$ACTION')) continue;
    const all = formData.getAll(key);
    result[key] = all.length > 1 ? all : all[0]!;
  }
  return result;
}
