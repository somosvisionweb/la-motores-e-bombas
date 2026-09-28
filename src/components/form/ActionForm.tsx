'use client';

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from 'react';
import { initialActionState, type ActionState } from '@/lib/action-state';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

interface FormContextValue {
  state: ActionState;
  pending: boolean;
}

const FormContext = createContext<FormContextValue>({ state: initialActionState, pending: false });

/** Estado do último envio do <ActionForm> (erros por campo, valores reenviados). */
export function useFormState(): FormContextValue {
  return useContext(FormContext);
}

/**
 * Formulário ligado a uma Server Action. Exibe erros gerais no topo, erros por campo (via campos do
 * design system) e toast de sucesso quando a ação retorna `ok` sem redirecionar.
 *
 * O sucesso é tratado assim que a resposta chega (dentro da própria ação), e não em um efeito: se a página
 * for atualizada e este formulário for recriado (ex.: `key` que muda com o saldo), o toast e o `onSuccess`
 * (fechar o modal) continuam acontecendo.
 */
export function ActionForm({
  action,
  children,
  className,
  successToast = true,
  resetOnSuccess = false,
  onSuccess,
  keepValues = false,
  id,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  successToast?: boolean;
  resetOnSuccess?: boolean;
  /** Chamado quando a ação retorna `ok` sem redirecionar (ex.: fechar um modal e atualizar a página). */
  onSuccess?: (state: ActionState) => void;
  /**
   * Não deixa o React reiniciar o formulário depois de cada envio (o padrão de `<form action>`).
   * Use quando há campos controlados por estado (ex.: botões de opção) que precisam continuar como estão após um erro.
   * Nesse modo o `useFormStatus` não enxerga o envio: o `SubmitButton` já lê o `pending` daqui; botões próprios devem usar `useFormState()`.
   */
  keepValues?: boolean;
  id?: string;
}) {
  const toast = useToast();
  const alertRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.ok && next.message) {
      if (successToast) toast.success(next.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(next);
    }
    return next;
  }, initialActionState);

  useEffect(() => {
    if (state.message && !state.ok) alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [state]);

  return (
    <FormContext value={{ state, pending }}>
      {/* Com `action` em função, o React já envia como multipart (arquivos incluídos): não definir encType. */}
      <form
        id={id}
        ref={formRef}
        action={keepValues ? undefined : formAction}
        onSubmit={
          keepValues
            ? (event) => {
                event.preventDefault();
                if (pending) return;
                const data = new FormData(event.currentTarget);
                startTransition(() => formAction(data));
              }
            : undefined
        }
        className={className}
        noValidate
      >
        {!state.ok && state.message ? (
          <div ref={alertRef} style={{ marginBottom: 16 }}>
            <Alert variant="danger">{state.message}</Alert>
          </div>
        ) : null}
        {children}
      </form>
    </FormContext>
  );
}
