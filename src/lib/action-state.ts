/** Estado retornado pelas Server Actions de formulário (usado com `useActionState`). */
export interface ActionState<T = unknown> {
  ok: boolean;
  /** Mensagem geral (sucesso ou erro). */
  message?: string;
  /** Erros por campo (chave = nome do campo, com "." para aninhados). */
  fieldErrors?: Record<string, string>;
  /** Valores enviados, para reexibir o formulário em caso de erro. */
  values?: Record<string, string>;
  /** Dados extras (ex.: id do registro criado). */
  data?: T;
}

export const initialActionState: ActionState = { ok: false };
