'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ActionState } from '@/lib/action-state';
import { ORDER_STATUS, ORDER_STATUS_KEYS, type OrderStatus } from '@/config/order-status';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/config/payment-methods';
import { ActionForm, useFormState } from '@/components/form/ActionForm';
import { HiddenField, MoneyField, SelectField, TextareaField, TextField } from '@/components/form/fields';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { computeOrderTotals } from '@/lib/order-totals';
import { formatBRL } from '@/lib/money';
import { isBlankItem, ItemsEditor, newItemKey, type ItemDraft } from './ItemsEditor';
import { CustomerPicker, type PickedCustomer } from './CustomerPicker';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export interface OrderFormInitial {
  id: number;
  number: number;
  status: OrderStatus;
  equipment: string;
  brand: string | null;
  model: string | null;
  problemDescription: string | null;
  diagnosis: string | null;
  serviceDescription: string | null;
  entryDate: string;
  expectedDeliveryDate: string | null;
  deliveredDate: string | null;
  nextServiceDate: string | null;
  technicianId: number | null;
  paymentMethod: PaymentMethod | null;
  discountCents: number;
  notes: string | null;
  items: Omit<ItemDraft, 'key'>[];
}

const EQUIPMENT_SUGGESTIONS = [
  'Motor elétrico',
  'Bomba d’água',
  'Bomba submersa',
  'Bomba de piscina',
  'Bomba autoaspirante',
  'Bomba injetora',
  'Bomba centrífuga',
  'Bomba periférica',
  'Motor de máquina de costura',
  'Motor compressor',
  'Motor de ar-condicionado',
  'Motor de elevador de carro',
  'Liquidificador industrial',
  'Forrageira',
  'Exaustor',
  'Ventilador',
  'Esmeril',
];

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="form-section">
      <h2 className="form-section__title">
        <span className="section-number">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Painel de totais (peças, mão de obra, desconto e total) — atualiza conforme os itens mudam. */
function TotalsPanel({ items, discountCents, onDiscountChange, discountDefault }: { items: ItemDraft[]; discountCents: number; onDiscountChange: (cents: number) => void; discountDefault: number }) {
  const totals = computeOrderTotals(items, discountCents);
  return (
    <div className="totals-panel">
      <MoneyField name="discountCents" label="Desconto" defaultCents={discountDefault} onCentsChange={onDiscountChange} hint="Opcional. Não pode passar do total dos itens." />
      <dl className="totals">
        <div>
          <dt>Peças</dt>
          <dd className="money">{formatBRL(totals.partsTotalCents)}</dd>
        </div>
        <div>
          <dt>Mão de obra / serviços</dt>
          <dd className="money">{formatBRL(totals.laborTotalCents)}</dd>
        </div>
        {totals.discountCents > 0 ? (
          <div>
            <dt>Desconto</dt>
            <dd className="money money--negative">−{formatBRL(totals.discountCents)}</dd>
          </div>
        ) : null}
        <div className="totals__grand">
          <dt>Valor total</dt>
          <dd className="money money--positive">{formatBRL(totals.totalCents)}</dd>
        </div>
      </dl>
    </div>
  );
}

function OrderFormBody({
  mode,
  order,
  customer,
  technicians,
  today,
  acceptedMethods,
  canCreateCustomer,
  cancelHref,
}: {
  mode: 'create' | 'edit';
  order?: OrderFormInitial;
  customer: PickedCustomer | null;
  technicians: { id: number; name: string }[];
  today: string;
  acceptedMethods: PaymentMethod[];
  canCreateCustomer: boolean;
  cancelHref: string;
}) {
  const { state } = useFormState();
  const [items, setItems] = useState<ItemDraft[]>(() => (order?.items ?? []).map((item) => ({ ...item, key: newItemKey() })));
  const [discount, setDiscount] = useState(order?.discountCents ?? 0);

  const payloadRows = useMemo(() => items.filter((item) => !isBlankItem(item)), [items]);
  const payloadIndex = useMemo(() => new Map(payloadRows.map((row, i) => [row.key, i])), [payloadRows]);
  const itemsJson = JSON.stringify(
    payloadRows.map(({ kind, serviceId, productId, description, quantity, unitPriceCents }) => ({ kind, serviceId, productId, description, quantity, unitPriceCents })),
  );
  const itemsError = state.fieldErrors?.items;
  const editing = mode === 'edit';
  const deliveredEditable = editing && order?.status === 'ENTREGUE';

  return (
    <>
      {order ? <HiddenField name="id" value={order.id} /> : null}
      <input type="hidden" name="items" value={itemsJson} />

      <Section number="1" title="Cliente">
        <CustomerPicker
          initial={customer}
          canCreate={canCreateCustomer}
          newCustomerHref={`/sistema/clientes/novo?retorno=${encodeURIComponent(editing ? `/sistema/ordens/${order!.id}/editar` : '/sistema/ordens/nova')}`}
        />
      </Section>

      <Section number="2" title="Equipamento e problema">
        <datalist id="equipment-suggestions">
          {EQUIPMENT_SUGGESTIONS.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
        <div className="form-grid">
          <TextField className="col-6" name="equipment" label="Equipamento" required defaultValue={order?.equipment} list="equipment-suggestions" placeholder="Ex.: Motor elétrico 1/2 cv" />
          <TextField className="col-3" name="brand" label="Marca" defaultValue={order?.brand} />
          <TextField className="col-3" name="model" label="Modelo" defaultValue={order?.model} />
          <TextareaField className="col-12" name="problemDescription" label="Descrição do problema" defaultValue={order?.problemDescription} rows={3} placeholder="O que o cliente relatou?" />
          <TextareaField className="col-12" name="diagnosis" label="Diagnóstico" defaultValue={order?.diagnosis} rows={3} placeholder="Causa encontrada na avaliação técnica" />
          <TextareaField className="col-12" name="serviceDescription" label="Serviço realizado" defaultValue={order?.serviceDescription} rows={3} placeholder="Descrição do serviço executado (aparece no documento)" />
        </div>
      </Section>

      <Section number="3" title="Serviços, peças e valores">
        <ItemsEditor items={items} onChange={setItems} errors={state.fieldErrors} payloadIndex={payloadIndex} />
        {itemsError ? (
          <p className="field__error" role="alert" style={{ marginTop: 8 }}>
            {itemsError}
          </p>
        ) : null}
        <div className="form-grid" style={{ marginTop: 20 }}>
          <div className="col-6">
            <SelectField
              name="paymentMethod"
              label="Forma de pagamento combinada"
              defaultValue={order?.paymentMethod ?? ''}
              placeholder="A definir"
              options={acceptedMethods.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
              hint="Os pagamentos efetivos são registrados na página da ordem."
            />
          </div>
          <div className="col-6">
            <TotalsPanel items={items} discountCents={discount} onDiscountChange={setDiscount} discountDefault={order?.discountCents ?? 0} />
          </div>
        </div>
      </Section>

      <Section number="4" title="Datas e responsável">
        <div className="form-grid">
          <TextField className="col-3" name="entryDate" label="Data de entrada" type="date" required defaultValue={order?.entryDate ?? today} />
          <TextField className="col-3" name="expectedDeliveryDate" label="Previsão de entrega" type="date" defaultValue={order?.expectedDeliveryDate} />
          <TextField className="col-3" name="nextServiceDate" label="Próximo serviço previsto" type="date" defaultValue={order?.nextServiceDate} hint="Manutenção preventiva/retorno" />
          <TextField
            className="col-3"
            name="deliveredDate"
            label="Data de entrega"
            type="date"
            defaultValue={order?.deliveredDate}
            readOnly={!deliveredEditable}
            hint={deliveredEditable ? undefined : 'Preenchida ao marcar como Entregue'}
          />
          <SelectField
            className="col-6"
            name="technicianId"
            label="Técnico responsável"
            defaultValue={order?.technicianId ?? ''}
            placeholder="Não definido"
            options={technicians.map((t) => ({ value: t.id, label: t.name }))}
          />
          {editing ? (
            <div className="col-6 field">
              <span className="field__label">Status atual</span>
              <p style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>{ORDER_STATUS[order!.status].label}</p>
              <p className="field__hint">Para alterar o status use o botão “Alterar status” na página da ordem.</p>
            </div>
          ) : (
            <SelectField
              className="col-6"
              name="status"
              label="Status inicial"
              defaultValue="AGUARDANDO_AVALIACAO"
              options={ORDER_STATUS_KEYS.filter((s) => s !== 'CANCELADO').map((s) => ({ value: s, label: ORDER_STATUS[s].label }))}
            />
          )}
        </div>
      </Section>

      <Section number="5" title="Observações">
        <TextareaField name="notes" label="Observações (aparecem no documento)" defaultValue={order?.notes} rows={3} />
      </Section>

      <div className="form-actions">
        <SubmitButton size="lg" pendingLabel="Salvando…">
          {editing ? 'Salvar alterações' : 'Criar ordem de serviço'}
        </SubmitButton>
        <Link href={cancelHref} className="btn btn--lg">
          Cancelar
        </Link>
      </div>
    </>
  );
}

export function OrderForm(props: {
  mode: 'create' | 'edit';
  action: Action;
  order?: OrderFormInitial;
  customer: PickedCustomer | null;
  technicians: { id: number; name: string }[];
  today: string;
  acceptedMethods: PaymentMethod[];
  canCreateCustomer: boolean;
  cancelHref: string;
}) {
  const { action, ...rest } = props;
  return (
    <ActionForm action={action} className="order-form" successToast={false}>
      <OrderFormBody {...rest} />
    </ActionForm>
  );
}
