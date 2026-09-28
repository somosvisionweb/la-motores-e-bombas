import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, FileText, MessageSquare, Printer } from 'lucide-react';
import { StoreOrderActions, StoreOrderNoteForm } from '@/components/system/store/StoreOrderActions';
import { StoreStatusBadge } from '@/components/system/store/StoreBadges';
import { Alert } from '@/components/ui/Alert';
import { Badge, DemoBadge, MethodBadge, PaymentStateBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { storeOrderTemplate } from '@/config/company-defaults';
import { isPaymentMethod, type PaymentMethod } from '@/config/payment-methods';
import { FULFILLMENT_LABEL, storePaymentLabel } from '@/config/store';
import { formatSaleCode, formatStoreOrderCode } from '@/lib/codes';
import { fullAddress } from '@/lib/company';
import { formatDateBR, formatDateTimeBR } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { buildWhatsAppUrl, displayPhone, toWhatsAppNumber } from '@/lib/phone';
import { applyTemplate } from '@/lib/text';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getCompanySettings } from '@/server/services/settings';
import { getSiteBaseUrl } from '@/server/services/site';
import { expireStaleStoreOrders, getStoreOrderDetail } from '@/server/services/store-orders';
import { getStoreSettings } from '@/server/services/store-settings';

export const metadata = { title: 'Pedido da loja' };

export default async function StoreOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('store.view');
  const { id } = await params;
  await expireStaleStoreOrders();
  const bundle = Number.isInteger(Number(id)) ? await getStoreOrderDetail(Number(id)) : null;
  if (!bundle) notFound();

  const { order, sale, items, payments, events, paidCents, balanceCents } = bundle;
  const [company, config] = await Promise.all([getCompanySettings(), getStoreSettings()]);
  const timezone = company.timezone;
  const code = formatStoreOrderCode(order.number);
  const baseUrl = await getSiteBaseUrl(company);
  const publicUrl = `${baseUrl}/loja/pedido/${order.token}`;

  const buyerNumber = toWhatsAppNumber(order.buyerPhone);
  const message = applyTemplate(storeOrderTemplate(company.whatsappTemplates), { nome: order.buyerName.split(' ')[0], empresa: company.name, codigo: code, link: publicUrl });
  const contactHref = buyerNumber && !order.isDemo ? buildWhatsAppUrl(buyerNumber, message) : null;

  const final = order.status === 'COMPLETED' || order.status === 'CANCELED';
  const canManage = hasPermission(user, 'store.manage');
  // A folha A4 do pedido é o documento da venda vinculada (mesma regra da página de impressão).
  const canPrint = hasPermission(user, 'documents.print') && hasPermission(user, 'sales.view');
  const canSeePayments = hasPermission(user, 'payments.view');
  const canCancel = paidCents === 0 || hasPermission(user, 'sales.cancel');
  const methods = company.paymentMethods.filter(isPaymentMethod).filter((m) => m !== 'BOLETO') as PaymentMethod[];
  const holdUntil = config.holdHours > 0 && !order.isDemo && order.paymentMethod === 'PIX' && order.status === 'RECEIVED' && paidCents === 0 ? new Date(order.createdAt.getTime() + config.holdHours * 3_600_000) : null;
  const subtotal = items.filter((i) => !i.isFee).reduce((sum, i) => sum + i.totalCents, 0);
  const address = order.deliveryAddress;

  return (
    <>
      <PageHeader
        title={code}
        badges={
          <>
            <StoreStatusBadge status={order.status} /> {order.isDemo ? <DemoBadge /> : null}
          </>
        }
        crumbs={[{ label: 'Loja online', href: '/sistema/loja' }, { label: code }]}
        subtitle={`${formatDateTimeBR(order.createdAt, timezone)} · ${order.buyerName} · ${FULFILLMENT_LABEL[order.fulfillment]}`}
        actions={
          <>
            {canPrint ? (
              <Link href={`/imprimir/venda/${sale.id}?auto=1`} className="btn">
                <Printer aria-hidden="true" /> Imprimir pedido (A4)
              </Link>
            ) : null}
            <StoreOrderActions
              orderId={order.id}
              status={order.status}
              fulfillment={order.fulfillment}
              paymentMethod={order.paymentMethod}
              balanceCents={balanceCents}
              methods={methods}
              canManage={canManage}
              canRegisterPayment={hasPermission(user, 'payments.create')}
              canCancel={canCancel}
              contactHref={contactHref}
              publicUrl={publicUrl}
            />
          </>
        }
      />

      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        {order.status === 'CANCELED' ? (
          <Alert variant="danger" title="Pedido cancelado">
            {order.cancelReason ? `Motivo: ${order.cancelReason}. ` : ''}Produtos devolvidos ao estoque e pagamentos estornados.
          </Alert>
        ) : null}
        {!final && order.paymentMethod === 'PIX' && balanceCents > 0 ? (
          <Alert variant="warning" title="Aguardando o pagamento por PIX">
            O cliente vai pagar {formatBRL(balanceCents)} pelo QR Code. Confira no aplicativo do banco e use “Confirmar pagamento PIX”.
            {holdUntil ? ` Os produtos ficam reservados até ${formatDateTimeBR(holdUntil, timezone)}; depois o pedido é cancelado sozinho.` : ''}
          </Alert>
        ) : null}
        {order.isDemo ? (
          <Alert variant="demo" title="Pedido de demonstração">
            Criado com preços fictícios: não mexe no estoque real e não deve ser entregue. Some junto com os demais dados de demonstração.
          </Alert>
        ) : null}

        <div className="page-grid">
          <div className="stack" style={{ ['--gap' as string]: '20px' }}>
            <Card>
              <CardHeader title="Itens do pedido" />
              <div className="table-wrap">
                <table className="table table--stack">
                  <thead>
                    <tr>
                      <th scope="col">Produto</th>
                      <th scope="col" className="num">
                        Qtd.
                      </th>
                      <th scope="col" className="num">
                        Unitário
                      </th>
                      <th scope="col" className="num">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="cell-primary" data-label="">
                          {item.description}
                          {item.isFee ? <Badge tone="slate">Taxa</Badge> : null}
                        </td>
                        <td className="num" data-label="Qtd.">
                          {item.quantity}
                        </td>
                        <td className="num" data-label="Unitário">
                          <Money cents={item.unitPriceCents} tone="muted" />
                        </td>
                        <td className="num" data-label="Total">
                          <Money cents={item.totalCents} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {order.deliveryFeeCents > 0 ? (
                      <tr>
                        <td colSpan={3} className="num">
                          Subtotal dos produtos
                        </td>
                        <td className="num">
                          <Money cents={subtotal} />
                        </td>
                      </tr>
                    ) : null}
                    <tr>
                      <td colSpan={3} className="num">
                        Valor total
                      </td>
                      <td className="num">
                        <Money cents={order.totalCents} tone="positive" />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {canSeePayments ? (
              <Card>
                <CardHeader
                  title="Pagamentos"
                  actions={
                    hasPermission(user, 'sales.view') ? (
                      <Link href={`/sistema/vendas/${sale.id}`} className="btn btn--sm">
                        <ExternalLink aria-hidden="true" /> Ver venda {formatSaleCode(sale.number)}
                      </Link>
                    ) : null
                  }
                />
                {payments.length === 0 ? (
                  <CardBody>
                    <p className="text-muted">Nenhum pagamento registrado ainda.</p>
                  </CardBody>
                ) : (
                  <div className="table-wrap">
                    <table className="table table--stack table--compact">
                      <thead>
                        <tr>
                          <th scope="col">Data</th>
                          <th scope="col">Forma</th>
                          <th scope="col">Situação</th>
                          <th scope="col" className="num">
                            Valor
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} style={payment.status === 'VOIDED' ? { opacity: 0.55 } : undefined}>
                            <td data-label="Data" className="nowrap">
                              {formatDateBR(payment.paidDate)}
                            </td>
                            <td data-label="Forma">
                              <MethodBadge method={payment.method} />
                            </td>
                            <td data-label="Situação">{payment.status === 'VOIDED' ? 'Estornado' : 'Recebido'}</td>
                            <td className="num" data-label="Valor">
                              <Money cents={payment.amountCents} tone={payment.status === 'VOIDED' ? 'muted' : 'positive'} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : null}

            <Card>
              <CardHeader title="Histórico do pedido" subtitle="O cliente vê no acompanhamento apenas os itens marcados como “Visível ao cliente”." />
              <CardBody>
                <ul className="store-timeline">
                  {[...events].reverse().map((event) => (
                    <li key={event.id}>
                      <time>{formatDateTimeBR(event.createdAt, timezone)}</time>
                      <span>
                        {event.type === 'NOTE' ? <MessageSquare aria-hidden="true" /> : null}
                        {event.message}
                        {event.userName ? <em> — {event.userName}</em> : null}
                      </span>
                      <Badge tone={event.isPublic ? 'green' : 'slate'}>{event.isPublic ? 'Visível ao cliente' : 'Interno'}</Badge>
                    </li>
                  ))}
                </ul>
                {canManage ? (
                  <div style={{ marginTop: 20 }}>
                    <StoreOrderNoteForm orderId={order.id} />
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </div>

          <aside className="stack" style={{ ['--gap' as string]: '16px' }}>
            <Card accent>
              <CardHeader title="Resumo" />
              <CardBody>
                <dl className="kv" style={{ gridTemplateColumns: 'auto 1fr' }}>
                  <dt>Total</dt>
                  <dd className="text-right">
                    <Money cents={order.totalCents} />
                  </dd>
                  {canSeePayments ? (
                    <>
                      <dt>Recebido</dt>
                      <dd className="text-right">
                        <Money cents={paidCents} tone="positive" />
                      </dd>
                      <dt>Saldo</dt>
                      <dd className="text-right">
                        <Money cents={balanceCents} tone={balanceCents > 0 ? 'negative' : 'muted'} />
                      </dd>
                      <dt>Situação</dt>
                      <dd className="text-right">{order.status === 'CANCELED' ? '—' : <PaymentStateBadge total={order.totalCents} paid={paidCents} />}</dd>
                    </>
                  ) : null}
                  <dt>Pagamento</dt>
                  <dd className="text-right">{storePaymentLabel(order.paymentMethod, order.fulfillment)}</dd>
                  <dt>Recebimento</dt>
                  <dd className="text-right">{FULFILLMENT_LABEL[order.fulfillment]}</dd>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Comprador" />
              <CardBody>
                <dl className="kv" style={{ gridTemplateColumns: 'auto 1fr' }}>
                  <dt>Nome</dt>
                  <dd className="text-right">{order.buyerName}</dd>
                  <dt>Telefone</dt>
                  <dd className="text-right">{displayPhone(order.buyerPhone)}</dd>
                  {order.buyerEmail ? (
                    <>
                      <dt>E-mail</dt>
                      <dd className="text-right" style={{ overflowWrap: 'anywhere' }}>
                        {order.buyerEmail}
                      </dd>
                    </>
                  ) : null}
                </dl>
                {sale.customerId && hasPermission(user, 'customers.view') ? (
                  <p style={{ marginTop: 12 }}>
                    <Link href={`/sistema/clientes/${sale.customerId}`}>Ver cadastro do cliente</Link>
                  </p>
                ) : null}
                {order.notes ? (
                  <div style={{ marginTop: 12 }}>
                    <p className="field__label">Observação do cliente</p>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{order.notes}</p>
                  </div>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={order.fulfillment === 'DELIVERY' ? 'Endereço de entrega' : 'Retirada na loja'} />
              <CardBody>
                {order.fulfillment === 'DELIVERY' && address ? (
                  <p>
                    {address.street}, {address.number}
                    {address.complement ? ` — ${address.complement}` : ''}
                    <br />
                    {address.district} · {address.city}/{address.state}
                    <br />
                    CEP {address.zip}
                  </p>
                ) : (
                  <p>{fullAddress(company)}</p>
                )}
              </CardBody>
            </Card>

            {hasPermission(user, 'documents.print') ? (
              <Card>
                <CardHeader title="Documentos" />
                <CardBody>
                  <div className="cluster">
                    <Link href={`/imprimir/venda/${sale.id}`} className="btn btn--sm">
                      <Printer aria-hidden="true" /> Comprovante
                    </Link>
                    <a href={`/api/documentos/venda/${sale.id}/pdf`} className="btn btn--sm">
                      <FileText aria-hidden="true" /> PDF
                    </a>
                  </div>
                </CardBody>
              </Card>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}
