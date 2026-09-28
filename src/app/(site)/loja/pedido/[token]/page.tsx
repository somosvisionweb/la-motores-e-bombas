import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CircleCheck, Clock, MapPin, Package } from 'lucide-react';
import { OrderPageEffects } from '@/components/store/OrderPageEffects';
import { CopyButton } from '@/components/store/CopyButton';
import { OrderTimeline } from '@/components/store/OrderTimeline';
import { StoreDemoBanner } from '@/components/store/StoreDemoBanner';
import { StoreHero } from '@/components/store/StoreHero';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { isPaymentMethod, PAYMENT_METHOD_LABEL } from '@/config/payment-methods';
import { customerStatusLabel, FULFILLMENT_LABEL, STORE_ORDER_STATUS, storePaymentLabel, type StoreOrderStatus } from '@/config/store';
import { formatStoreOrderCode } from '@/lib/codes';
import { fullAddress, hoursLines, mapsUrl, whatsappLink } from '@/lib/company';
import { formatDateTimeBR } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { param, type SearchParams } from '@/lib/query';
import { linkProps } from '@/lib/site-links';
import { storeMetadata } from '@/lib/store-seo';
import { getSiteData } from '@/server/services/site';
import { getStoreOrderByToken } from '@/server/services/store-orders';
import { pixQrDataUrl } from '@/server/services/store-pix';
import { getStoreSettings } from '@/server/services/store-settings';

/** (81) •••••-6655: o link é a "senha" do pedido, então o telefone aparece só em parte. */
function maskPhone(digits: string): string {
  if (digits.length < 8) return '';
  return `(${digits.slice(0, 2)}) •••••-${digits.slice(-4)}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getSiteData();
  return {
    ...storeMetadata({ title: 'Acompanhar pedido', description: 'Acompanhe o seu pedido na loja virtual.', path: '/loja', siteName: company.name, noindex: true }),
    // O endereço deste acompanhamento é secreto: não vaza como "origem" para outros sites.
    referrer: 'no-referrer',
  };
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchParams> }) {
  const { token } = await params;
  const isNew = param(await searchParams, 'novo') === '1';
  const bundle = await getStoreOrderByToken(token);
  if (!bundle) notFound();

  const { order, items, events, paidCents } = bundle;
  const [site, config] = await Promise.all([getSiteData(), getStoreSettings()]);
  const { company } = site;
  const timezone = company.timezone;
  const code = formatStoreOrderCode(order.number);
  const status = order.status;
  const paid = order.totalCents > 0 && paidCents >= order.totalCents;
  const finished = status === 'COMPLETED' || status === 'CANCELED';
  const showPix = order.paymentMethod === 'PIX' && Boolean(order.pixPayload) && !paid && !finished;
  const qr = showPix ? await pixQrDataUrl(order.pixPayload!) : null;

  // Quando cada etapa aconteceu (a linha do tempo pública é montada pelos eventos).
  const moments: Partial<Record<StoreOrderStatus, Date | null>> = { RECEIVED: order.createdAt };
  for (const event of events) if (event.type !== 'NOTE' && event.toStatus) moments[event.toStatus] = event.createdAt;
  const publicEvents = events.filter((event) => event.isPublic && event.message);

  const hold = config.holdHours > 0 && !order.isDemo && order.paymentMethod === 'PIX' && !paid && status === 'RECEIVED';
  const holdUntil = hold ? new Date(order.createdAt.getTime() + config.holdHours * 3_600_000) : null;
  const onSiteMethods = company.paymentMethods.filter(isPaymentMethod).filter((m) => m !== 'BOLETO').map((m) => PAYMENT_METHOD_LABEL[m]);
  const address = order.deliveryAddress;

  const contactHref = whatsappLink(company, `Olá! Tenho uma dúvida sobre o pedido ${code} (${formatBRL(order.totalCents)}).`);
  const proofHref = whatsappLink(company, `Olá! Segue o comprovante do PIX do pedido ${code} (${formatBRL(order.totalCents)}).`);

  return (
    <>
      <StoreHero title={`Pedido ${code}`} crumbs={[{ label: 'Início', href: '/' }, { label: 'Loja', href: '/loja' }, { label: code }]}>
        <p className="store-hero__status">
          <span className={`badge badge--tone-${STORE_ORDER_STATUS[status].tone} badge--dot`}>{customerStatusLabel(status, order.fulfillment)}</span>
          <span>Feito em {formatDateTimeBR(order.createdAt, timezone)}</span>
        </p>
      </StoreHero>

      <section className="site-section store-page">
        <div className="site-container store-order">
          <OrderPageEffects token={token} number={order.number} justPlaced={isNew} />
          {isNew ? (
            <>
              <div className="store-success" role="status">
                <CircleCheck aria-hidden="true" />
                <div>
                  <strong>Pedido enviado!</strong>
                  <p>
                    Guarde esta página: é por ela que você acompanha o pedido. {order.paymentMethod === 'PIX' && !paid ? 'Falta só o pagamento por PIX abaixo.' : 'A loja vai confirmar o seu pedido.'}
                  </p>
                </div>
              </div>
            </>
          ) : null}
          {order.isDemo ? <StoreDemoBanner /> : null}

          <OrderTimeline status={status} fulfillment={order.fulfillment} moments={moments} timezone={timezone} />

          <div className="store-order__grid">
            <div className="store-order__main">
              {showPix && qr ? (
                <section className="store-panel store-panel--pix" aria-labelledby="pix-title">
                  <h2 id="pix-title">Pague com PIX</h2>
                  {order.isDemo ? (
                    <p className="store-panel__warn">
                      <strong>Demonstração:</strong> este código é apenas um exemplo e não recebe pagamentos. Não pague.
                    </p>
                  ) : null}
                  <div className="pix">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt={`QR Code PIX de ${formatBRL(order.totalCents)}`} width={240} height={240} />
                    <div className="pix__code">
                      <p className="pix__amount">
                        Valor a pagar: <strong>{formatBRL(order.totalCents)}</strong>
                      </p>
                      <label htmlFor="pix-copia-e-cola">PIX copia e cola</label>
                      <textarea id="pix-copia-e-cola" readOnly rows={5} defaultValue={order.pixPayload!} />
                      <CopyButton text={order.pixPayload!} label="Copiar código PIX" />
                    </div>
                  </div>
                  <ol className="store-steps">
                    <li>Abra o aplicativo do seu banco e escolha pagar com PIX (QR Code ou copia e cola).</li>
                    <li>Confira o valor e o nome do recebedor antes de confirmar.</li>
                    <li>Depois de pagar, a loja confirma o pagamento e este pedido é atualizado aqui.</li>
                  </ol>
                  {holdUntil ? (
                    <p className="store-panel__note">
                      <Clock aria-hidden="true" /> Reservamos os produtos até {formatDateTimeBR(holdUntil, timezone)}. Sem o pagamento nesse prazo, o pedido é cancelado.
                    </p>
                  ) : null}
                  {proofHref && !order.isDemo ? (
                    <a href={proofHref} className="btn" {...linkProps(proofHref)}>
                      <WhatsAppIcon /> Enviar comprovante pelo WhatsApp
                    </a>
                  ) : null}
                </section>
              ) : null}

              {paid && status !== 'CANCELED' ? (
                <section className="store-panel store-panel--ok">
                  <h2>
                    <CircleCheck aria-hidden="true" /> Pagamento confirmado
                  </h2>
                  <p>Recebemos {formatBRL(paidCents)}. Obrigado pela compra!</p>
                </section>
              ) : null}

              {!paid && !finished && order.paymentMethod === 'ON_SITE' ? (
                <section className="store-panel">
                  <h2>{storePaymentLabel('ON_SITE', order.fulfillment)}</h2>
                  <p>
                    Você paga <strong>{formatBRL(order.totalCents)}</strong> {order.fulfillment === 'DELIVERY' ? 'quando receber o pedido' : 'quando retirar o pedido na loja'}.
                    {onSiteMethods.length > 0 ? ` Formas aceitas: ${onSiteMethods.join(', ')}.` : ''}
                  </p>
                </section>
              ) : null}

              {status !== 'CANCELED' && status !== 'COMPLETED' ? (
                <section className="store-panel">
                  <h2>
                    {order.fulfillment === 'DELIVERY' ? <Package aria-hidden="true" /> : <MapPin aria-hidden="true" />} {FULFILLMENT_LABEL[order.fulfillment]}
                  </h2>
                  {order.fulfillment === 'PICKUP' ? (
                    <>
                      <p>
                        <strong>{company.name}</strong>
                        <br />
                        {fullAddress(company)}
                      </p>
                      {config.pickupNote ? <p>{config.pickupNote}</p> : null}
                      <p className="store-panel__hours">
                        <strong>Horário de atendimento</strong>
                        {hoursLines(company.hours).map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </p>
                      <a href={mapsUrl(company)} className="btn btn--sm" {...linkProps(mapsUrl(company))}>
                        Como chegar
                      </a>
                    </>
                  ) : (
                    <>
                      {address ? (
                        <p>
                          {address.street}, {address.number}
                          {address.complement ? ` — ${address.complement}` : ''}
                          <br />
                          {address.district} · {address.city}/{address.state} · CEP {address.zip}
                        </p>
                      ) : null}
                      {config.deliveryNote ? <p>{config.deliveryNote}</p> : null}
                    </>
                  )}
                </section>
              ) : null}

              {publicEvents.length > 0 ? (
                <section className="store-panel">
                  <h2>Histórico</h2>
                  <ul className="store-history">
                    {[...publicEvents].reverse().map((event) => (
                      <li key={event.id}>
                        <time>{formatDateTimeBR(event.createdAt, timezone)}</time>
                        <span>{event.message}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <aside className="store-order__side">
              <section className="store-panel">
                <h2>Resumo</h2>
                <ul className="summary-lines">
                  {items.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.quantity} × {item.description}
                      </span>
                      <span className="tabular">{formatBRL(item.totalCents)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="summary-totals">
                  <div>
                    <dt>Subtotal</dt>
                    <dd className="tabular">{formatBRL(order.subtotalCents)}</dd>
                  </div>
                  {order.fulfillment === 'DELIVERY' ? (
                    <div>
                      <dt>Entrega</dt>
                      <dd className="tabular">{order.deliveryFeeCents > 0 ? formatBRL(order.deliveryFeeCents) : 'Grátis'}</dd>
                    </div>
                  ) : null}
                  <div className="summary-totals__total">
                    <dt>Total</dt>
                    <dd className="tabular">{formatBRL(order.totalCents)}</dd>
                  </div>
                </dl>
                <dl className="store-kv">
                  <div>
                    <dt>Pagamento</dt>
                    <dd>{storePaymentLabel(order.paymentMethod, order.fulfillment)}</dd>
                  </div>
                  <div>
                    <dt>Comprador</dt>
                    <dd>
                      {order.buyerName}
                      <br />
                      {maskPhone(order.buyerPhone)}
                    </dd>
                  </div>
                </dl>
              </section>

              <div className="store-order__actions">
                {contactHref ? (
                  <a href={contactHref} className="btn btn--primary btn--block" {...linkProps(contactHref)}>
                    <WhatsAppIcon /> Falar sobre este pedido
                  </a>
                ) : null}
                <Link href="/loja" className="btn btn--block">
                  Continuar comprando
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
