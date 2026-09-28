import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Ban, FileText, Printer } from 'lucide-react';
import { voidPaymentAction } from '@/actions/orders';
import { cancelSaleAction, registerSalePaymentAction } from '@/actions/sales';
import { PaymentDialog } from '@/components/system/orders/OrderActions';
import { ChannelBadge } from '@/components/system/store/StoreBadges';
import { Alert } from '@/components/ui/Alert';
import { Badge, DemoBadge, MethodBadge, PaymentStateBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { isPaymentMethod, type PaymentMethod } from '@/config/payment-methods';
import { formatSaleCode, formatStoreOrderCode } from '@/lib/codes';
import { formatDateBR, todayISO } from '@/lib/dates';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getSaleDetail } from '@/server/services/sales';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Venda' };

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('sales.view');
  const { id } = await params;
  const detail = Number.isInteger(Number(id)) ? await getSaleDetail(Number(id)) : null;
  if (!detail) notFound();

  const { sale, customer, items, payments, creatorName, storeOrder, paidCents, balanceCents } = detail;
  const company = await getCompanySettings();
  const code = formatSaleCode(sale.number);
  const canPay = hasPermission(user, 'payments.create') && sale.status === 'ACTIVE' && balanceCents > 0;
  const canSeePayments = hasPermission(user, 'payments.view');
  const canPrint = hasPermission(user, 'documents.print');
  const methods = company.paymentMethods.filter(isPaymentMethod) as PaymentMethod[];
  const subtotal = items.reduce((s, i) => s + i.totalCents, 0);

  return (
    <>
      <PageHeader
        title={code}
        badges={
          <>
            {sale.status === 'CANCELED' ? <Badge tone="red" dot>Cancelada</Badge> : <Badge tone="green" dot>Ativa</Badge>} {sale.isDemo ? <DemoBadge /> : null} <ChannelBadge channel={sale.channel} />
          </>
        }
        crumbs={[{ label: 'Vendas', href: '/sistema/vendas' }, { label: code }]}
        subtitle={`${formatDateBR(sale.saleDate)} · ${customer ? customer.name : (storeOrder?.buyerName ?? 'Consumidor final')}`}
        actions={
          <>
            {canPay ? <PaymentDialog orderId={sale.id} action={registerSalePaymentAction} balanceCents={balanceCents} defaultMethod={null} methods={methods} today={todayISO(company.timezone)} /> : null}
            {canPrint ? (
              <>
                <Link href={`/imprimir/venda/${sale.id}`} className="btn">
                  <Printer aria-hidden="true" /> Imprimir
                </Link>
                <a href={`/api/documentos/venda/${sale.id}/pdf`} className="btn">
                  <FileText aria-hidden="true" /> PDF
                </a>
              </>
            ) : null}
            {hasPermission(user, 'sales.cancel') && sale.status === 'ACTIVE' ? (
              <ConfirmActionForm
                action={cancelSaleAction}
                fields={{ id: sale.id }}
                title="Cancelar esta venda?"
                message="Os produtos voltam ao estoque e os pagamentos recebidos serão estornados."
                confirmLabel="Cancelar venda"
                triggerLabel="Cancelar venda"
                triggerIcon={<Ban aria-hidden="true" />}
                triggerSize="md"
                reasonLabel="Motivo (opcional)"
              />
            ) : null}
          </>
        }
      />

      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        {sale.status === 'CANCELED' ? (
          <Alert variant="danger" title="Venda cancelada">
            {sale.cancelReason ? `Motivo: ${sale.cancelReason}. ` : ''}Produtos devolvidos ao estoque e pagamentos estornados.
          </Alert>
        ) : null}
        <div className="page-grid">
          <div className="stack" style={{ ['--gap' as string]: '20px' }}>
            <Card>
              <CardHeader title="Itens da venda" />
              <div className="table-wrap">
                <table className="table table--stack">
                  <thead>
                    <tr>
                      <th scope="col">Produto</th>
                      <th scope="col" className="num">Qtd.</th>
                      <th scope="col" className="num">Unitário</th>
                      <th scope="col" className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="cell-primary" data-label="">{item.description}</td>
                        <td className="num" data-label="Qtd.">{item.quantity}</td>
                        <td className="num" data-label="Unitário"><Money cents={item.unitPriceCents} tone="muted" /></td>
                        <td className="num" data-label="Total"><Money cents={item.totalCents} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {sale.discountCents > 0 ? (
                      <>
                        <tr>
                          <td colSpan={3} className="num">Subtotal</td>
                          <td className="num"><Money cents={subtotal} /></td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="num">Desconto</td>
                          <td className="num"><Money cents={-sale.discountCents} tone="negative" /></td>
                        </tr>
                      </>
                    ) : null}
                    <tr>
                      <td colSpan={3} className="num">Valor total</td>
                      <td className="num"><Money cents={sale.totalCents} tone="positive" /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {canSeePayments ? (
              <Card>
                <CardHeader title="Pagamentos" />
                {payments.length === 0 ? (
                  <CardBody>
                    <p className="text-muted">Nenhum pagamento registrado.</p>
                  </CardBody>
                ) : (
                  <div className="table-wrap">
                    <table className="table table--stack table--compact">
                      <thead>
                        <tr>
                          <th scope="col">Data</th>
                          <th scope="col">Forma</th>
                          <th scope="col">Observação</th>
                          <th scope="col" className="num">Valor</th>
                          <th scope="col" className="actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id} style={p.status === 'VOIDED' ? { opacity: 0.55 } : undefined}>
                            <td data-label="Data" className="nowrap">{formatDateBR(p.paidDate)}</td>
                            <td data-label="Forma"><MethodBadge method={p.method} /></td>
                            <td data-label="Observação" className="text-muted">{p.status === 'VOIDED' ? `Estornado: ${p.voidReason ?? ''}` : p.notes || '—'}</td>
                            <td className="num" data-label="Valor"><Money cents={p.amountCents} tone={p.status === 'VOIDED' ? 'muted' : 'positive'} /></td>
                            <td className="actions" data-label="">
                              <span className="cluster" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                {p.status === 'PAID' && canPrint ? (
                                  <Link href={`/imprimir/recibo/${p.id}`} className="btn btn--sm">Recibo</Link>
                                ) : null}
                                {p.status === 'PAID' && hasPermission(user, 'payments.void') ? (
                                  <ConfirmActionForm
                                    action={voidPaymentAction}
                                    fields={{ id: p.id }}
                                    title="Estornar pagamento?"
                                    message="O valor deixará de contar nas entradas do financeiro."
                                    confirmLabel="Estornar"
                                    triggerLabel="Estornar"
                                    reasonLabel="Motivo do estorno"
                                    reasonRequired
                                  />
                                ) : null}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : null}
          </div>

          <aside className="stack" style={{ ['--gap' as string]: '16px' }}>
            <Card accent>
              <CardHeader title="Resumo" />
              <CardBody>
                <dl className="kv" style={{ gridTemplateColumns: 'auto 1fr' }}>
                  <dt>Total</dt>
                  <dd className="text-right"><Money cents={sale.totalCents} /></dd>
                  {canSeePayments ? (
                    <>
                      <dt>Recebido</dt>
                      <dd className="text-right"><Money cents={paidCents} tone="positive" /></dd>
                      <dt>Saldo</dt>
                      <dd className="text-right"><Money cents={balanceCents} tone={balanceCents > 0 ? 'negative' : 'muted'} /></dd>
                      <dt>Situação</dt>
                      <dd className="text-right">{sale.status === 'CANCELED' ? '—' : <PaymentStateBadge total={sale.totalCents} paid={paidCents} />}</dd>
                    </>
                  ) : null}
                  <dt>Registrada por</dt>
                  <dd className="text-right">{creatorName ?? (storeOrder ? 'Loja online' : '—')}</dd>
                </dl>
                {customer ? (
                  <p style={{ marginTop: 12 }}>
                    <Link href={`/sistema/clientes/${customer.id}`}>Ver cadastro do cliente</Link>
                  </p>
                ) : null}
                {storeOrder && hasPermission(user, 'store.view') ? (
                  <p style={{ marginTop: 12 }}>
                    <Link href={`/sistema/loja/${storeOrder.id}`}>Ver pedido {formatStoreOrderCode(storeOrder.number)} da loja online</Link>
                  </p>
                ) : null}
              </CardBody>
            </Card>
            {sale.notes ? (
              <Card>
                <CardHeader title="Observações" />
                <CardBody>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{sale.notes}</p>
                </CardBody>
              </Card>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}
