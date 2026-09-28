'use client';

import { useState } from 'react';
import { Ban, Banknote, CheckCheck, PackageCheck, Truck } from 'lucide-react';
import { cancelStoreOrderAction, changeStoreOrderStatusAction, confirmStorePaymentAction, addStoreOrderNoteAction } from '@/actions/store';
import { ActionForm } from '@/components/form/ActionForm';
import { CheckboxField, HiddenField, SelectField, TextareaField } from '@/components/form/fields';
import { CopyButton } from '@/components/store/CopyButton';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { Modal } from '@/components/ui/Modal';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/config/payment-methods';
import { allowedNextStatuses, STORE_ORDER_STATUS, type Fulfillment, type StoreOrderStatus, type StorePaymentMethod } from '@/config/store';
import { formatBRL } from '@/lib/money';

export interface StoreOrderActionsProps {
  orderId: number;
  status: StoreOrderStatus;
  fulfillment: Fulfillment;
  paymentMethod: StorePaymentMethod;
  balanceCents: number;
  /** Formas de pagamento oferecidas ao concluir um pedido com saldo. */
  methods: PaymentMethod[];
  canManage: boolean;
  canRegisterPayment: boolean;
  canCancel: boolean;
  /** Link do WhatsApp para falar com o comprador (com o link do acompanhamento). */
  contactHref: string | null;
  publicUrl: string;
}

function StatusButton({ orderId, to, label, primary, icon }: { orderId: number; to: StoreOrderStatus; label: string; primary?: boolean; icon?: React.ReactNode }) {
  return (
    <ActionForm action={changeStoreOrderStatusAction} className="cluster" successToast>
      <HiddenField name="id" value={orderId} />
      <HiddenField name="status" value={to} />
      <SubmitButton variant={primary ? 'primary' : 'secondary'} pendingLabel="Atualizando…">
        {icon} {label}
      </SubmitButton>
    </ActionForm>
  );
}

/** Concluir: se ainda há saldo a receber, pede a forma de pagamento (a entrada vai para o Financeiro). */
function CompleteButton({ orderId, fulfillment, balanceCents, methods, canRegisterPayment, primary }: { orderId: number; fulfillment: Fulfillment; balanceCents: number; methods: PaymentMethod[]; canRegisterPayment: boolean; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const label = fulfillment === 'DELIVERY' ? 'Concluir (entregue)' : 'Concluir (retirado)';
  const needsPayment = balanceCents > 0;
  return (
    <>
      <button type="button" className={primary ? 'btn btn--primary' : 'btn'} onClick={() => setOpen(true)}>
        <PackageCheck aria-hidden="true" /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Concluir pedido">
        <ActionForm action={changeStoreOrderStatusAction} className="stack" successToast onSuccess={() => setOpen(false)}>
          <HiddenField name="id" value={orderId} />
          <HiddenField name="status" value="COMPLETED" />
          {needsPayment ? (
            <>
              <p>
                Ainda há <strong className="tabular">{formatBRL(balanceCents)}</strong> a receber. Ao concluir, o pagamento é registrado no financeiro.
              </p>
              {canRegisterPayment ? (
                <SelectField name="paymentMethod" label="Forma de pagamento recebida" required defaultValue={methods[0] ?? 'DINHEIRO'} options={methods.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
              ) : (
                <p className="text-muted">Você não tem permissão para registrar pagamentos. Peça a um administrador.</p>
              )}
            </>
          ) : (
            <p>O pedido está totalmente pago. Confirme que o cliente {fulfillment === 'DELIVERY' ? 'recebeu' : 'retirou'} os produtos.</p>
          )}
          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Voltar
            </button>
            <SubmitButton pendingLabel="Concluindo…" disabled={needsPayment && !canRegisterPayment}>
              Concluir pedido
            </SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}

/** Ações do pedido no topo da página de detalhe: o próximo passo em destaque e as demais em botões secundários. */
export function StoreOrderActions(props: StoreOrderActionsProps) {
  const { orderId, status, fulfillment, paymentMethod, balanceCents, methods, canManage, canRegisterPayment, canCancel } = props;
  const next = allowedNextStatuses(status, fulfillment);
  const final = status === 'COMPLETED' || status === 'CANCELED';
  const awaitingPix = paymentMethod === 'PIX' && balanceCents > 0 && !final;

  return (
    <>
      {canManage && !final ? (
        <>
          {awaitingPix && canRegisterPayment ? (
            <ConfirmActionForm
              action={confirmStorePaymentAction}
              fields={{ id: orderId }}
              title="Confirmar o pagamento por PIX?"
              message={
                <>
                  Confirme somente depois de conferir no aplicativo do banco que <strong>{formatBRL(balanceCents)}</strong> entraram. O valor é lançado no financeiro e o pedido passa
                  para “Confirmado”.
                </>
              }
              confirmLabel="Sim, recebi o PIX"
              variant="primary"
              triggerLabel="Confirmar pagamento PIX"
              triggerIcon={<Banknote aria-hidden="true" />}
              triggerVariant="primary"
              triggerSize="md"
            />
          ) : null}
          {status === 'RECEIVED' ? <StatusButton orderId={orderId} to="CONFIRMED" label="Confirmar pedido" primary={!awaitingPix} icon={<CheckCheck aria-hidden="true" />} /> : null}
          {status === 'CONFIRMED' ? <StatusButton orderId={orderId} to="READY" label={fulfillment === 'DELIVERY' ? 'Marcar pronto para entrega' : 'Marcar pronto para retirada'} primary icon={<PackageCheck aria-hidden="true" />} /> : null}
          {status === 'READY' && fulfillment === 'DELIVERY' && next.includes('OUT_FOR_DELIVERY') ? <StatusButton orderId={orderId} to="OUT_FOR_DELIVERY" label={STORE_ORDER_STATUS.OUT_FOR_DELIVERY.label} primary icon={<Truck aria-hidden="true" />} /> : null}
          {next.includes('COMPLETED') ? (
            <CompleteButton orderId={orderId} fulfillment={fulfillment} balanceCents={balanceCents} methods={methods} canRegisterPayment={canRegisterPayment} primary={status === 'OUT_FOR_DELIVERY' || (status === 'READY' && fulfillment === 'PICKUP')} />
          ) : null}
        </>
      ) : null}
      {props.contactHref ? (
        <a href={props.contactHref} className="btn" target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon /> Avisar cliente
        </a>
      ) : null}
      <CopyButton text={props.publicUrl} label="Copiar link do cliente" className="btn" />
      {canManage && canCancel && !final ? (
        <ConfirmActionForm
          action={cancelStoreOrderAction}
          fields={{ id: orderId }}
          title="Cancelar este pedido?"
          message="Os produtos voltam ao estoque, pagamentos recebidos são estornados e o cliente vê o pedido como cancelado."
          confirmLabel="Cancelar pedido"
          triggerLabel="Cancelar pedido"
          triggerIcon={<Ban aria-hidden="true" />}
          triggerSize="md"
          reasonLabel="Motivo (opcional, fica só no sistema)"
        />
      ) : null}
    </>
  );
}

/** Observação na linha do tempo: interna (só a equipe) ou pública (o cliente vê no acompanhamento). */
export function StoreOrderNoteForm({ orderId }: { orderId: number }) {
  return (
    <ActionForm action={addStoreOrderNoteAction} className="stack" successToast resetOnSuccess>
      <HiddenField name="id" value={orderId} />
      <TextareaField name="message" label="Adicionar observação" rows={2} maxLength={500} required placeholder="Ex.: cliente pediu para separar até as 17h" />
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <CheckboxField name="isPublic" label="Mostrar ao cliente no acompanhamento do pedido" />
        <SubmitButton variant="secondary" size="sm" pendingLabel="Salvando…">
          Registrar
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
