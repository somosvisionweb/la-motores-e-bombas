'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ActionState } from '@/lib/action-state';
import { ActionForm, useFormState } from '@/components/form/ActionForm';
import { CheckboxField, DocumentField, HiddenField, PhoneField, TextareaField, TextField } from '@/components/form/fields';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { onlyDigits } from '@/lib/text';

export interface CustomerFormValues {
  id?: number;
  name?: string;
  phone?: string | null;
  whatsapp?: string | null;
  document?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Campos do cliente (reutilizados no cadastro completo e no cadastro rápido dentro da OS). */
export function CustomerFields({ customer, compact }: { customer?: CustomerFormValues; compact?: boolean }) {
  const { state } = useFormState();
  const initialSame = !customer?.whatsapp || onlyDigits(customer.whatsapp) === onlyDigits(customer.phone);
  const [same, setSame] = useState(state.values ? state.values.whatsappSame === 'on' : initialSame);
  const duplicate = Boolean((state.data as { duplicate?: boolean } | undefined)?.duplicate);

  return (
    <>
      <div className="form-grid">
        <TextField className="col-8" name="name" label="Nome do cliente" required defaultValue={customer?.name} autoComplete="off" autoFocus={!customer} />
        <DocumentField className="col-4" name="document" label="CPF / CNPJ" defaultValue={customer?.document} hint="Opcional" />
        <PhoneField className="col-4" name="phone" label="Telefone" defaultValue={customer?.phone} />
        <div className="col-4 field">
          {same ? (
            <>
              <span className="field__label">WhatsApp</span>
              <p className="text-muted" style={{ fontSize: 13, minHeight: 40, display: 'flex', alignItems: 'center' }}>
                Mesmo número do telefone
              </p>
            </>
          ) : (
            <PhoneField name="whatsapp" label="WhatsApp" defaultValue={customer?.whatsapp} />
          )}
          <label className="check" style={{ fontSize: 13 }}>
            <input type="checkbox" name="whatsappSame" checked={same} onChange={(e) => setSame(e.target.checked)} />
            É o mesmo do telefone
          </label>
        </div>
        <TextField className="col-4" name="email" label="E-mail" type="email" defaultValue={customer?.email} hint="Opcional" />
        <TextField className="col-12" name="address" label="Endereço" defaultValue={customer?.address} placeholder="Rua, número, bairro, cidade" />
        {compact ? null : (
          <TextareaField className="col-12" name="notes" label="Observações" defaultValue={customer?.notes} rows={3} hint="Informações úteis sobre o cliente (ex.: melhor horário de contato)." />
        )}
      </div>
      {duplicate ? (
        <div style={{ marginTop: 16 }}>
          <CheckboxField name="allowDuplicate" label="Cadastrar mesmo assim (é outra pessoa com o mesmo telefone)" />
        </div>
      ) : null}
    </>
  );
}

export function CustomerForm({
  action,
  customer,
  returnTo,
  cancelHref,
  submitLabel = 'Salvar cliente',
}: {
  action: Action;
  customer?: CustomerFormValues;
  returnTo?: string;
  cancelHref: string;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="stack" successToast={false}>
      {customer?.id ? <HiddenField name="id" value={customer.id} /> : null}
      {returnTo ? <HiddenField name="returnTo" value={returnTo} /> : null}
      <CustomerFields customer={customer} />
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="btn">
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}
