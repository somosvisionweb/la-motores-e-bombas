'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { ActionState } from '@/lib/action-state';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/config/payment-methods';
import { ActionForm, useFormState } from '@/components/form/ActionForm';
import { MoneyField, SelectField, TextareaField, TextField } from '@/components/form/fields';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { computeOrderTotals } from '@/lib/order-totals';
import { formatBRL } from '@/lib/money';
import { CustomerPicker, type PickedCustomer } from '../orders/CustomerPicker';
import { isBlankItem, ItemsEditor, type ItemDraft } from '../orders/ItemsEditor';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

// "Imprimir o comprovante ao registrar a venda": a escolha fica guardada neste navegador (padrão: ligada).
const PRINT_KEY = 'la-imprimir-ao-registrar-venda';
const printListeners = new Set<() => void>();
/** Valor em memória: garante que a caixa funcione mesmo em navegador sem armazenamento (modo privado). */
let printInMemory: boolean | null = null;

function subscribePrint(listener: () => void): () => void {
  printListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    printListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readPrintPreference(): boolean {
  if (printInMemory !== null) return printInMemory;
  try {
    return window.localStorage.getItem(PRINT_KEY) !== '0';
  } catch {
    return true;
  }
}

function writePrintPreference(value: boolean): void {
  printInMemory = value;
  try {
    window.localStorage.setItem(PRINT_KEY, value ? '1' : '0');
  } catch {
    /* sem armazenamento: vale só até recarregar */
  }
  for (const listener of printListeners) listener();
}

function usePrintAfterSale(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribePrint, readPrintPreference, () => true);
  return [value, writePrintPreference];
}

function SaleFormBody({
  today,
  acceptedMethods,
  canCreateCustomer,
  canPay,
  canPrint,
  customer,
}: {
  today: string;
  acceptedMethods: PaymentMethod[];
  canCreateCustomer: boolean;
  canPay: boolean;
  canPrint: boolean;
  customer: PickedCustomer | null;
}) {
  const { state } = useFormState();
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [discount, setDiscount] = useState(0);
  const [payNow, setPayNow] = useState(canPay);
  const [printAfter, setPrintAfter] = usePrintAfterSale();

  const rows = useMemo(() => items.filter((item) => !isBlankItem(item)), [items]);
  const payloadIndex = useMemo(() => new Map(rows.map((row, i) => [row.key, i])), [rows]);
  const itemsJson = JSON.stringify(rows.map(({ productId, description, quantity, unitPriceCents }) => ({ productId, description, quantity, unitPriceCents })));
  const totals = computeOrderTotals(rows.map((r) => ({ kind: 'PART' as const, quantity: r.quantity, unitPriceCents: r.unitPriceCents })), discount);

  return (
    <>
      <input type="hidden" name="items" value={itemsJson} />
      <section className="form-section">
        <h2 className="form-section__title">
          <span className="section-number">1</span>Cliente e data
        </h2>
        <div className="stack" style={{ ['--gap' as string]: '16px' }}>
          <CustomerPicker initial={customer} canCreate={canCreateCustomer} optional newCustomerHref={`/sistema/clientes/novo?retorno=${encodeURIComponent('/sistema/vendas/nova')}`} />
          <div className="form-grid">
            <TextField className="col-4" name="saleDate" label="Data da venda" type="date" required defaultValue={today} />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section__title">
          <span className="section-number">2</span>Produtos
        </h2>
        <ItemsEditor items={items} onChange={setItems} errors={state.fieldErrors} payloadIndex={payloadIndex} kinds={['PART']} productLabel="Produto" />
        {state.fieldErrors?.items ? (
          <p className="field__error" role="alert" style={{ marginTop: 8 }}>
            {state.fieldErrors.items}
          </p>
        ) : null}
      </section>

      <section className="form-section">
        <h2 className="form-section__title">
          <span className="section-number">3</span>Valores e pagamento
        </h2>
        <div className="form-grid">
          <div className="col-6 stack" style={{ ['--gap' as string]: '16px' }}>
            <MoneyField name="discountCents" label="Desconto" defaultCents={0} onCentsChange={setDiscount} hint="Opcional." />
            {canPay ? (
              <>
                <label className="check">
                  <input type="checkbox" name="payNow" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />
                  Receber o pagamento agora (valor total)
                </label>
                {payNow ? (
                  <SelectField
                    name="paymentMethod"
                    label="Forma de pagamento"
                    required
                    defaultValue={acceptedMethods[0] ?? 'PIX'}
                    options={acceptedMethods.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
                  />
                ) : (
                  <p className="field__hint">Sem pagamento agora: a venda fica com saldo a receber e você registra o pagamento depois.</p>
                )}
              </>
            ) : null}
            <TextareaField name="notes" label="Observações" rows={2} maxLength={1000} />
          </div>
          <div className="col-6">
            <dl className="totals">
              <div>
                <dt>Subtotal</dt>
                <dd className="money">{formatBRL(totals.subtotalCents)}</dd>
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
        </div>
      </section>

      {canPrint ? (
        <label className="check" style={{ marginBottom: 12 }}>
          <input type="checkbox" name="print" value="1" checked={printAfter} onChange={(event) => setPrintAfter(event.target.checked)} />
          Imprimir o comprovante (A4) ao registrar a venda
        </label>
      ) : null}
      <div className="form-actions">
        <SubmitButton size="lg" pendingLabel="Registrando…">
          Registrar venda
        </SubmitButton>
        <Link href="/sistema/vendas" className="btn btn--lg">
          Cancelar
        </Link>
      </div>
    </>
  );
}

export function SaleForm(props: {
  action: Action;
  today: string;
  acceptedMethods: PaymentMethod[];
  canCreateCustomer: boolean;
  canPay: boolean;
  /** Pode imprimir documentos (mostra a opção "imprimir ao registrar"). */
  canPrint: boolean;
  customer: PickedCustomer | null;
}) {
  const { action, ...rest } = props;
  return (
    <ActionForm action={action} className="order-form" successToast={false}>
      <SaleFormBody {...rest} />
    </ActionForm>
  );
}
