'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { saveExpenseCategoryAction } from '@/actions/finance';
import type { ActionState } from '@/lib/action-state';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/config/payment-methods';
import { ActionForm } from '@/components/form/ActionForm';
import { CheckboxField, HiddenField, MoneyField, SelectField, TextareaField, TextField } from '@/components/form/fields';
import { Modal } from '@/components/ui/Modal';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { CustomerPicker, type PickedCustomer } from '../orders/CustomerPicker';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function StandalonePaymentForm({
  action,
  today,
  methods,
  canPickCustomer,
  canCreateCustomer,
}: {
  action: Action;
  today: string;
  methods: PaymentMethod[];
  canPickCustomer: boolean;
  canCreateCustomer: boolean;
}) {
  const noCustomer: PickedCustomer | null = null;
  return (
    <ActionForm action={action} className="stack" successToast={false}>
      <div className="form-grid">
        <TextField className="col-8" name="description" label="Descrição" required maxLength={200} placeholder="Ex.: serviço externo, venda sem cadastro…" autoFocus />
        <TextField className="col-4" name="paidDate" label="Data do recebimento" type="date" required defaultValue={today} />
        <MoneyField className="col-4" name="amountCents" label="Valor recebido" required />
        <SelectField className="col-4" name="method" label="Forma de pagamento" required defaultValue={methods[0] ?? 'PIX'} options={methods.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
        <div className="col-4" />
        {canPickCustomer ? (
          <div className="col-12">
            <CustomerPicker initial={noCustomer} canCreate={canCreateCustomer} optional newCustomerHref={`/sistema/clientes/novo?retorno=${encodeURIComponent('/sistema/financeiro/entradas/nova')}`} />
          </div>
        ) : null}
        <TextareaField className="col-12" name="notes" label="Observações" rows={2} maxLength={500} />
      </div>
      <p className="text-muted" style={{ fontSize: 13 }}>
        Use esta opção para entradas que não pertencem a uma ordem de serviço nem a uma venda. Pagamentos de OS e vendas são registrados nas próprias páginas.
      </p>
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">Registrar entrada</SubmitButton>
        <Link href="/sistema/financeiro/entradas" className="btn">
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}

export function ExpenseForm({
  action,
  categories,
  suppliers,
  methods,
  today,
  expense,
}: {
  action: Action;
  categories: { id: number; name: string }[];
  suppliers: string[];
  methods: PaymentMethod[];
  today: string;
  expense?: {
    id: number;
    date: string;
    description: string;
    supplier: string | null;
    categoryId: number;
    amountCents: number;
    paymentMethod: PaymentMethod | null;
    notes: string | null;
  };
}) {
  return (
    <ActionForm action={action} className="stack" successToast={false}>
      {expense ? <HiddenField name="id" value={expense.id} /> : null}
      <datalist id="suppliers">
        {suppliers.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="form-grid">
        <TextField className="col-8" name="description" label="Descrição" required defaultValue={expense?.description} maxLength={200} autoFocus={!expense} />
        <TextField className="col-4" name="date" label="Data" type="date" required defaultValue={expense?.date ?? today} />
        <TextField className="col-6" name="supplier" label="Fornecedor" defaultValue={expense?.supplier} list="suppliers" maxLength={120} />
        <SelectField className="col-6" name="categoryId" label="Categoria" required defaultValue={expense?.categoryId ?? ''} placeholder="Escolha…" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <MoneyField className="col-4" name="amountCents" label="Valor" required defaultCents={expense?.amountCents ?? 0} />
        <SelectField className="col-4" name="paymentMethod" label="Forma de pagamento" defaultValue={expense?.paymentMethod ?? ''} placeholder="Não informada" options={methods.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
        <div className="col-4" />
        <TextareaField className="col-12" name="notes" label="Observações" defaultValue={expense?.notes} rows={2} maxLength={500} />
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">{expense ? 'Salvar alterações' : 'Lançar custo'}</SubmitButton>
        <Link href="/sistema/financeiro/custos" className="btn">
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}

export function ExpenseCategoryDialog({ category }: { category?: { id: number; name: string; isGoods: boolean } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={category ? 'btn btn--sm btn--icon' : 'btn btn--primary'} onClick={() => setOpen(true)} aria-label={category ? `Editar ${category.name}` : undefined} title={category ? 'Editar' : undefined}>
        {category ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {category ? null : 'Nova categoria'}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={category ? 'Editar categoria' : 'Nova categoria de custo'}>
        <ActionForm action={saveExpenseCategoryAction} className="stack" successToast onSuccess={() => setOpen(false)} key={category?.name ?? 'new'}>
          {category ? <HiddenField name="id" value={category.id} /> : null}
          <TextField name="name" label="Nome da categoria" required defaultValue={category?.name} maxLength={60} autoFocus />
          <CheckboxField name="isGoods" label="É custo de mercadorias (alimenta o card “Custo de mercadorias”)" defaultChecked={category?.isGoods} />
          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
