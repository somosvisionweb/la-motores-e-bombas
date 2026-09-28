'use client';

import { useState } from 'react';
import { ArrowRight, Banknote, RefreshCw } from 'lucide-react';
import { addOrderNoteAction, changeOrderStatusAction, registerOrderPaymentAction } from '@/actions/orders';
import { ActionForm } from '@/components/form/ActionForm';
import { HiddenField, MoneyField, SelectField, TextareaField, TextField } from '@/components/form/fields';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ORDER_STATUS, ORDER_STATUS_KEYS, type OrderStatus } from '@/config/order-status';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/config/payment-methods';
import type { ActionState } from '@/lib/action-state';
import { formatBRL } from '@/lib/money';

/** Botão de avanço rápido: leva a OS para a próxima etapa do fluxo com um clique. */
export function AdvanceStatusButton({ orderId, next }: { orderId: number; next: OrderStatus }) {
  return (
    <ActionForm action={changeOrderStatusAction} successToast className="cluster" id={`advance-${orderId}`}>
      <HiddenField name="id" value={orderId} />
      <HiddenField name="status" value={next} />
      <SubmitButton variant="brand" pendingLabel="Atualizando…">
        Avançar para “{ORDER_STATUS[next].label}” <ArrowRight aria-hidden="true" />
      </SubmitButton>
    </ActionForm>
  );
}

export function StatusDialog({ orderId, current, balanceCents, paidCents }: { orderId: number; current: OrderStatus; balanceCents: number; paidCents: number }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OrderStatus | ''>('');

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <RefreshCw aria-hidden="true" /> Alterar status
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Alterar status da ordem">
        <ActionForm action={changeOrderStatusAction} className="stack" successToast onSuccess={() => setOpen(false)}>
          <HiddenField name="id" value={orderId} />
          <p className="text-muted">
            Status atual: <strong>{ORDER_STATUS[current].label}</strong>
          </p>
          <div className="field">
            <label className="field__label" htmlFor="status-select">
              Novo status <span className="req">*</span>
            </label>
            <select id="status-select" name="status" className="select" required value={selected} onChange={(e) => setSelected(e.target.value as OrderStatus)}>
              <option value="">Selecione…</option>
              {ORDER_STATUS_KEYS.filter((s) => s !== current).map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS[s].label}
                </option>
              ))}
            </select>
            {selected ? <p className="field__hint">{ORDER_STATUS[selected].hint}</p> : null}
          </div>
          {selected === 'ENTREGUE' && balanceCents > 0 ? (
            <Alert variant="warning" title="Há saldo a receber">
              Esta ordem ainda tem {formatBRL(balanceCents)} a receber. Você pode entregar e registrar o pagamento depois, mas ele ficará como pendente.
            </Alert>
          ) : null}
          {selected === 'CANCELADO' && paidCents > 0 ? (
            <Alert variant="danger" title="Ordem com pagamentos">
              Estorne os pagamentos registrados antes de cancelar a ordem.
            </Alert>
          ) : null}
          {selected === 'CANCELADO' && current !== 'CANCELADO' ? <p className="text-muted">As peças vinculadas ao estoque serão devolvidas.</p> : null}
          <TextareaField name="note" label="Observação (opcional)" rows={3} maxLength={500} hint="Fica registrada no histórico da ordem." />
          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <SubmitButton pendingLabel="Salvando…" disabled={!selected}>
              Confirmar alteração
            </SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}

export function PaymentDialog({
  orderId,
  action = registerOrderPaymentAction,
  balanceCents,
  defaultMethod,
  methods,
  today,
  label = 'Registrar pagamento',
}: {
  /** Id da OS (ou da venda, quando `action` é a ação de pagamento de venda). */
  orderId: number;
  action?: (state: ActionState, formData: FormData) => Promise<ActionState>;
  balanceCents: number;
  defaultMethod: PaymentMethod | null;
  methods: PaymentMethod[];
  today: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
        <Banknote aria-hidden="true" /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar pagamento">
        <ActionForm key={balanceCents} action={action} className="stack" successToast onSuccess={() => setOpen(false)}>
          <HiddenField name="id" value={orderId} />
          <p className="text-muted">
            Saldo a receber: <strong className="tabular">{formatBRL(balanceCents)}</strong>
          </p>
          <MoneyField name="amountCents" label="Valor recebido" required defaultCents={balanceCents} hint="Preenchido com o saldo; altere para um pagamento parcial." />
          <SelectField
            name="method"
            label="Forma de pagamento"
            required
            defaultValue={defaultMethod ?? methods[0] ?? 'PIX'}
            options={methods.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
          />
          <TextField name="paidDate" label="Data do pagamento" type="date" required defaultValue={today} />
          <TextField name="notes" label="Observação (opcional)" maxLength={200} />
          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <SubmitButton pendingLabel="Registrando…">Confirmar pagamento</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}

export function OrderNoteForm({ orderId }: { orderId: number }) {
  return (
    <ActionForm action={addOrderNoteAction} className="stack" successToast resetOnSuccess>
      <HiddenField name="id" value={orderId} />
      <TextareaField name="message" label="Adicionar comentário interno" rows={2} maxLength={1000} placeholder="Ex.: cliente avisou que retira amanhã à tarde" />
      <div>
        <SubmitButton variant="brand" size="sm" pendingLabel="Salvando…">
          Adicionar ao histórico
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
