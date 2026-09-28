'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleCheck, ShoppingCart, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { placeOrderAction } from '@/actions/store';
import { ActionForm, useFormState } from '@/components/form/ActionForm';
import { CheckboxField, PhoneField, TextareaField, TextField } from '@/components/form/fields';
import { formatBRL } from '@/lib/money';
import type { Fulfillment, StorePaymentMethod } from '@/config/store';
import { clearCart, useCart } from './cart-store';
import { useResolvedCart } from './useResolvedCart';

export interface CheckoutConfig {
  deliveryEnabled: boolean;
  deliveryFeeCents: number;
  freeDeliveryMinCents: number | null;
  deliveryNote: string | null;
  pickupNote: string | null;
  minOrderCents: number;
  pixAvailable: boolean;
  policyText: string | null;
  /** Endereço da política de privacidade (null quando a empresa ainda não cadastrou). */
  privacyHref: string | null;
  /** Formas aceitas no balcão (ex.: Dinheiro, PIX, Cartão). */
  onSiteMethods: string[];
  pickupAddress: string;
  /** Momento em que a página foi montada (proteção contra robôs: envio rápido demais é recusado). */
  startedAt: number;
}

export function CheckoutForm(props: CheckoutConfig) {
  const router = useRouter();
  const [sent, setSent] = useState(false);

  return (
    <ActionForm
      action={placeOrderAction}
      className="checkout"
      successToast={false}
      keepValues
      onSuccess={(state) => {
        const url = (state.data as { url?: string } | undefined)?.url;
        setSent(true);
        clearCart();
        if (url) router.push(url);
      }}
    >
      <div className="checkout__layout" hidden={sent}>
        <CheckoutFields {...props} />
      </div>
      {sent ? (
        <div className="checkout-sent" role="status">
          <CircleCheck aria-hidden="true" />
          <p>Pedido enviado! Abrindo o acompanhamento…</p>
        </div>
      ) : null}
    </ActionForm>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  title,
  price,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  price?: string;
  children?: React.ReactNode;
}) {
  return (
    <label className="choice" data-checked={checked}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span className="choice__body">
        <span className="choice__title">
          <strong>{title}</strong>
          {price ? <span className="choice__price">{price}</span> : null}
        </span>
        {children ? <span className="choice__hint">{children}</span> : null}
      </span>
    </label>
  );
}

function CheckoutFields(props: CheckoutConfig) {
  const { items } = useCart();
  const { data, loading, failed } = useResolvedCart(items);
  const { state, pending } = useFormState();
  const [fulfillment, setFulfillment] = useState<Fulfillment>('PICKUP');
  const [payment, setPayment] = useState<StorePaymentMethod>(props.pixAvailable ? 'PIX' : 'ON_SITE');

  if (items.length === 0) {
    return (
      <div className="cart-empty checkout__empty">
        <span className="cart-empty__icon">
          <ShoppingCart aria-hidden="true" />
        </span>
        <p className="cart-empty__title">Seu carrinho está vazio</p>
        <p>Adicione produtos para finalizar a compra.</p>
        <Link href="/loja" className="btn btn--primary">
          Ver produtos da loja
        </Link>
      </div>
    );
  }

  const demo = Boolean(data?.hasDemo);
  const pixOk = props.pixAvailable || demo;
  const activePayment: StorePaymentMethod = payment === 'PIX' && !pixOk ? 'ON_SITE' : payment;

  const byId = new Map((data?.lines ?? []).map((line) => [line.productId, line]));
  const missing = new Set(data?.missingIds ?? []);
  const lines = items.flatMap((item) => {
    const line = byId.get(item.id);
    return line && !line.issue ? [{ line, qty: item.qty }] : [];
  });
  const subtotal = lines.reduce((sum, { line, qty }) => sum + line.unitPriceCents * qty, 0);
  const hasIssues = Boolean(data?.hasIssues) || missing.size > 0;
  const freeDelivery = props.freeDeliveryMinCents !== null && props.freeDeliveryMinCents > 0 && subtotal >= props.freeDeliveryMinCents;
  const fee = fulfillment === 'DELIVERY' && !freeDelivery ? props.deliveryFeeCents : 0;
  const total = subtotal + fee;
  const belowMin = props.minOrderCents > 0 && subtotal < props.minOrderCents;
  const ready = Boolean(data) && !loading && !failed && !hasIssues && !belowMin;
  const deliveryPrice = freeDelivery ? 'Grátis' : props.deliveryFeeCents > 0 ? formatBRL(props.deliveryFeeCents) : 'Grátis';
  const onSitePrefix = fulfillment === 'DELIVERY' ? 'Pagar na entrega' : 'Pagar na retirada';

  return (
    <>
      <div className="checkout__main">
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <input type="hidden" name="startedAt" value={props.startedAt} />
        {/* Campo-isca: pessoas não veem nem preenchem; robôs costumam preencher tudo. */}
        <div className="hp" aria-hidden="true">
          <label>
            Não preencha este campo
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <section className="checkout-step">
          <h2>
            <span>1</span> Seus dados
          </h2>
          <div className="form-grid">
            <TextField className="col-12" name="name" label="Nome completo" required autoComplete="name" maxLength={120} />
            <PhoneField className="col-6" name="phone" label="WhatsApp ou telefone" required hint="Usamos para avisar sobre o pedido." />
            <TextField className="col-6" name="email" type="email" label="E-mail (opcional)" autoComplete="email" maxLength={120} />
          </div>
        </section>

        <section className="checkout-step">
          <h2>
            <span>2</span> Como receber
          </h2>
          <div className="choices" role="radiogroup" aria-label="Como receber o pedido">
            <Choice name="fulfillment" value="PICKUP" checked={fulfillment === 'PICKUP'} onChange={() => setFulfillment('PICKUP')} title="Retirar na loja" price="Grátis">
              {props.pickupAddress}
              {props.pickupNote ? <> · {props.pickupNote}</> : null}
            </Choice>
            {props.deliveryEnabled ? (
              <Choice name="fulfillment" value="DELIVERY" checked={fulfillment === 'DELIVERY'} onChange={() => setFulfillment('DELIVERY')} title="Receber em casa" price={deliveryPrice}>
                {props.deliveryNote ?? 'Informe o endereço de entrega abaixo.'}
                {props.freeDeliveryMinCents && !freeDelivery ? <> Grátis em compras a partir de {formatBRL(props.freeDeliveryMinCents)}.</> : null}
              </Choice>
            ) : null}
          </div>
          {state.fieldErrors?.fulfillment ? (
            <p className="field__error" role="alert">
              {state.fieldErrors.fulfillment}
            </p>
          ) : null}

          <div className="form-grid checkout__address" hidden={fulfillment !== 'DELIVERY'}>
            <TextField className="col-4" name="zip" label="CEP" required inputMode="numeric" autoComplete="postal-code" maxLength={9} />
            <TextField className="col-8" name="street" label="Rua" required autoComplete="address-line1" maxLength={120} />
            <TextField className="col-3" name="number" label="Número" required maxLength={20} />
            <TextField className="col-9" name="complement" label="Complemento (opcional)" maxLength={80} />
            <TextField className="col-5" name="district" label="Bairro" required maxLength={80} />
            <TextField className="col-5" name="city" label="Cidade" required autoComplete="address-level2" maxLength={80} />
            <TextField className="col-2" name="state" label="UF" required autoComplete="address-level1" maxLength={2} />
          </div>
        </section>

        <section className="checkout-step">
          <h2>
            <span>3</span> Pagamento
          </h2>
          <div className="choices" role="radiogroup" aria-label="Forma de pagamento">
            {pixOk ? (
              <Choice name="paymentMethod" value="PIX" checked={activePayment === 'PIX'} onChange={() => setPayment('PIX')} title="PIX">
                Depois de finalizar você recebe o QR Code e o código “copia e cola”. A loja confirma o pagamento e separa o pedido.
                {!props.pixAvailable ? <strong> (Demonstração: este código não recebe pagamentos.)</strong> : null}
              </Choice>
            ) : null}
            <Choice name="paymentMethod" value="ON_SITE" checked={activePayment === 'ON_SITE'} onChange={() => setPayment('ON_SITE')} title={onSitePrefix}>
              {props.onSiteMethods.length > 0 ? `Formas aceitas: ${props.onSiteMethods.join(', ')}.` : 'Combine a forma de pagamento com a loja.'}
            </Choice>
          </div>
          {state.fieldErrors?.paymentMethod ? (
            <p className="field__error" role="alert">
              {state.fieldErrors.paymentMethod}
            </p>
          ) : null}
        </section>

        <section className="checkout-step">
          <h2>
            <span>4</span> Observações
          </h2>
          <TextareaField name="notes" label="Alguma informação para a loja? (opcional)" rows={3} maxLength={300} placeholder="Ex.: medida do rolamento, horário para retirada…" />
          {props.policyText ? (
            <div className="checkout-terms">
              <details>
                <summary>Condições da loja</summary>
                <p>{props.policyText}</p>
              </details>
              <CheckboxField name="acceptTerms" label="Li e concordo com as condições da loja" />
              {state.fieldErrors?.acceptTerms ? (
                <p className="field__error" role="alert">
                  {state.fieldErrors.acceptTerms}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <aside className="checkout__summary" aria-label="Resumo do pedido">
        <h2>Resumo do pedido</h2>
        {demo ? (
          <p className="cart-summary__demo">
            <strong>Demonstração:</strong> preços fictícios. Este pedido é apenas um teste e nada será entregue.
          </p>
        ) : null}
        {!data && !failed ? (
          <div className="skeleton-stack" aria-busy="true">
            <span className="skeleton skeleton--line" />
            <span className="skeleton skeleton--line" />
            <span className="skeleton skeleton--line skeleton--short" />
          </div>
        ) : (
          <ul className="summary-lines">
            {lines.map(({ line, qty }) => (
              <li key={line.productId}>
                <span>
                  {qty} × {line.name}
                </span>
                <span className="tabular">{formatBRL(line.unitPriceCents * qty)}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="summary-totals">
          <div>
            <dt>Subtotal</dt>
            <dd className="tabular">{data ? formatBRL(subtotal) : '—'}</dd>
          </div>
          {fulfillment === 'DELIVERY' ? (
            <div>
              <dt>Entrega</dt>
              <dd className="tabular">{fee > 0 ? formatBRL(fee) : 'Grátis'}</dd>
            </div>
          ) : null}
          <div className="summary-totals__total">
            <dt>Total</dt>
            <dd className="tabular">{data ? formatBRL(total) : '—'}</dd>
          </div>
        </dl>

        {hasIssues ? (
          <p className="cart-summary__alert" role="alert">
            <TriangleAlert aria-hidden="true" /> Há itens com problema de estoque.{' '}
            <Link href="/loja/carrinho">Ajustar o carrinho</Link>
          </p>
        ) : null}
        {belowMin ? (
          <p className="cart-summary__alert" role="alert">
            <TriangleAlert aria-hidden="true" /> O pedido mínimo da loja é {formatBRL(props.minOrderCents)}.
          </p>
        ) : null}
        {failed ? <p className="cart-summary__alert">Não foi possível conferir os preços agora. Verifique sua conexão.</p> : null}

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={!ready || pending} aria-busy={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {pending ? 'Enviando pedido…' : 'Finalizar pedido'}
        </button>
        <p className="cart-summary__note">Você recebe um link para acompanhar o pedido. Nenhum pagamento é cobrado neste botão.</p>
        {props.privacyHref ? (
          <p className="cart-summary__note">
            Usamos seus dados só para atender este pedido.{' '}
            <a href={props.privacyHref} target="_blank" rel="noopener noreferrer">
              Política de privacidade
            </a>
            .
          </p>
        ) : null}
        <Link href="/loja/carrinho" className="btn btn--ghost btn--block">
          Voltar ao carrinho
        </Link>
      </aside>
    </>
  );
}
