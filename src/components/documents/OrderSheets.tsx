import { formatBRL } from '@/lib/money';
import type { OrderDocument, ReceiptDocument, SaleDocument } from '@/server/documents/model';
import { Field, SheetFooter, SheetHeader, SheetSection, SheetTitle } from './Sheet';

const FIRST_PAGE_ITEMS = 9;
const NEXT_PAGE_ITEMS = 26;

function chunkItems<T>(items: T[]): T[][] {
  if (items.length <= FIRST_PAGE_ITEMS) return [items];
  const chunks: T[][] = [items.slice(0, FIRST_PAGE_ITEMS)];
  for (let i = FIRST_PAGE_ITEMS; i < items.length; i += NEXT_PAGE_ITEMS) chunks.push(items.slice(i, i + NEXT_PAGE_ITEMS));
  return chunks;
}

function TermsBlocks({ terms }: { terms: OrderDocument['terms'] }) {
  return (
    <div className="terms">
      <h2>{terms.title}</h2>
      {terms.blocks.map((block, index) => {
        switch (block.type) {
          case 'clause':
            return (
              <p key={index} className="terms__clause">
                {block.text}
              </p>
            );
          case 'subheading':
            return (
              <p key={index} className="terms__sub">
                {block.text}
              </p>
            );
          case 'paragraph':
            return <p key={index}>{block.text}</p>;
          case 'bullets':
            return (
              <ul key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          case 'highlight':
            return (
              <p key={index} className="terms__highlight">
                {block.text}
              </p>
            );
        }
      })}
    </div>
  );
}

/** Ordem de serviço / recibo em folhas A4 (a primeira traz os dados; a última, os termos de garantia). */
export function OrderSheets({ doc }: { doc: OrderDocument }) {
  const chunks = chunkItems(doc.items);
  const totalPages = chunks.length + 1;
  const t = doc.totals;

  const itemsTable = (items: OrderDocument['items']) => (
    <table className="sheet__table">
      <thead>
        <tr>
          <th style={{ width: '13%' }}>Tipo</th>
          <th>Descrição</th>
          <th className="num" style={{ width: '8%' }}>
            Qtd.
          </th>
          <th className="num" style={{ width: '17%' }}>
            Unitário
          </th>
          <th className="num" style={{ width: '17%' }}>
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td>{item.kind === 'SERVICE' ? 'Serviço' : 'Peça'}</td>
            <td>{item.description}</td>
            <td className="num">{item.quantity}</td>
            <td className="num">{formatBRL(item.unitPriceCents)}</td>
            <td className="num">
              <b>{formatBRL(item.totalCents)}</b>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      {chunks.map((items, pageIndex) => {
        const isFirst = pageIndex === 0;
        const isLast = pageIndex === chunks.length - 1;
        return (
          <section className="sheet" key={pageIndex} aria-label={`Ordem de serviço ${doc.code}, página ${pageIndex + 1}`}>
            <SheetHeader company={doc.company} />
            <SheetTitle title={isFirst ? doc.title : `${doc.title} — continuação`} code={doc.code} issuedOn={doc.issuedOn} />

            {isFirst ? (
              <>
                <SheetSection title="Dados do cliente">
                  <div className="sheet__grid">
                    <Field label="Nome" value={doc.customer.name} span={2} />
                    <Field label="CPF / CNPJ" value={doc.customer.document} span={2} />
                    <Field label="Contato" value={doc.customer.contact} span={2} />
                    <Field label="Endereço" value={doc.customer.address} span={2} />
                  </div>
                </SheetSection>
                <SheetSection title="Serviço">
                  <div className="sheet__grid">
                    <Field label="Equipamento" value={[doc.equipment, doc.brandModel].filter(Boolean).join(' — ')} span={3} />
                    <Field label="Situação" value={doc.statusLabel} />
                    <Field label="Descrição do serviço" value={doc.serviceDescription} span={3} />
                    <Field label="Valor" value={<b>{formatBRL(t.totalCents)}</b>} />
                    <Field label="Data de entrada" value={doc.entryDate} />
                    <Field label="Previsão de entrega" value={doc.expectedDate} />
                    <Field label="Data de entrega" value={doc.deliveredDate} />
                    <Field label="Próximo serviço previsto" value={doc.nextServiceDate} />
                    {doc.problem && doc.problem !== doc.serviceDescription ? <Field label="Problema relatado" value={doc.problem} span={4} /> : null}
                    {doc.diagnosis ? <Field label="Diagnóstico" value={doc.diagnosis} span={4} /> : null}
                  </div>
                </SheetSection>
              </>
            ) : null}

            {items.length > 0 ? <SheetSection title={isFirst ? 'Itens do atendimento' : 'Itens (continuação)'}>{itemsTable(items)}</SheetSection> : null}

            {isLast ? (
              <>
                <div className="sheet__totals">
                  {t.partsTotalCents > 0 ? (
                    <div>
                      <span>Peças</span>
                      <b>{formatBRL(t.partsTotalCents)}</b>
                    </div>
                  ) : null}
                  {t.laborTotalCents > 0 ? (
                    <div>
                      <span>Mão de obra / serviços</span>
                      <b>{formatBRL(t.laborTotalCents)}</b>
                    </div>
                  ) : null}
                  {t.discountCents > 0 ? (
                    <div className="neg">
                      <span>Desconto</span>
                      <b>−{formatBRL(t.discountCents)}</b>
                    </div>
                  ) : null}
                  <div className="grand">
                    <span>Valor total</span>
                    <b>{formatBRL(t.totalCents)}</b>
                  </div>
                  {t.paidCents > 0 ? (
                    <div>
                      <span>Recebido</span>
                      <b style={{ color: 'var(--green-700)' }}>{formatBRL(t.paidCents)}</b>
                    </div>
                  ) : null}
                  {t.paidCents > 0 && t.balanceCents > 0 ? (
                    <div className="neg">
                      <span>Saldo a receber</span>
                      <b>{formatBRL(t.balanceCents)}</b>
                    </div>
                  ) : null}
                </div>

                <div className="sheet__grid" style={{ marginTop: 10 }}>
                  {doc.payments.length > 0 ? (
                    <Field label="Pagamentos recebidos" value={doc.payments.map((p) => `${p.date} — ${p.method}: ${formatBRL(p.amountCents)}`).join('\n')} span={4} />
                  ) : doc.paymentMethod ? (
                    <Field label="Forma de pagamento combinada" value={doc.paymentMethod} span={4} />
                  ) : null}
                  {doc.notes ? <Field label="Observações" value={doc.notes} span={4} /> : null}
                </div>

                <SheetSection title="Responsável">
                  <div className="sheet__signatures">
                    <div className="sheet__signature">
                      <strong>Assinatura do técnico responsável</strong>
                      {doc.technician ? <span>{doc.technician}</span> : null}
                    </div>
                    <div className="sheet__signature">
                      <strong>Assinatura do cliente</strong>
                      <span>{doc.customer.name}</span>
                    </div>
                  </div>
                </SheetSection>
              </>
            ) : null}

            <div className="sheet__spacer" />
            <SheetFooter company={doc.company} page={pageIndex + 1} pages={totalPages} />
          </section>
        );
      })}

      <section className="sheet" aria-label="Termos e condições de garantia">
        <SheetHeader company={doc.company} />
        <div style={{ height: 14 }} />
        <TermsBlocks terms={doc.terms} />
        <div className="sheet__spacer" />
        <SheetFooter company={doc.company} page={totalPages} pages={totalPages} />
      </section>
    </>
  );
}

export function ReceiptSheet({ doc }: { doc: ReceiptDocument }) {
  return (
    <section className="sheet" aria-label={`Recibo ${doc.code}`}>
      <SheetHeader company={doc.company} />
      <SheetTitle title={doc.title} code={doc.code} issuedOn={doc.issuedOn} />
      <div className="receipt-amount">
        <div>
          <small>Valor recebido</small>
          <strong>{formatBRL(doc.amountCents)}</strong>
        </div>
        <p>({doc.amountInWords})</p>
      </div>
      <p style={{ marginBottom: 12, fontSize: '10.5pt' }}>
        Recebemos de <b>{doc.payer.name}</b>
        {doc.payer.document ? ` (${doc.payer.document})` : ''} a quantia de {formatBRL(doc.amountCents)} ({doc.amountInWords}), referente a {doc.reference}, pago em {doc.method} no dia{' '}
        {doc.paidDate}.
      </p>
      <SheetSection title="Detalhes do pagamento">
        <div className="sheet__grid">
          <Field label="Pagador" value={doc.payer.name} span={2} />
          <Field label="Forma de pagamento" value={doc.method} />
          <Field label="Data do pagamento" value={doc.paidDate} />
          <Field label="Referente a" value={doc.reference} span={2} />
          {doc.totalCents !== null ? <Field label="Valor total" value={formatBRL(doc.totalCents)} /> : null}
          {doc.balanceAfterCents !== null ? <Field label="Saldo restante" value={formatBRL(doc.balanceAfterCents)} /> : null}
          {doc.notes ? <Field label="Observações" value={doc.notes} span={4} /> : null}
        </div>
      </SheetSection>
      <div className="sheet__signatures">
        <div className="sheet__signature">
          <strong>{doc.company.name}</strong>
          <span>Assinatura / carimbo</span>
        </div>
        <div className="sheet__signature">
          <strong>{doc.payer.name}</strong>
          <span>Assinatura do cliente</span>
        </div>
      </div>
      <div className="sheet__spacer" />
      <SheetFooter company={doc.company} page={1} pages={1} />
    </section>
  );
}

export function SaleSheet({ doc }: { doc: SaleDocument }) {
  const t = doc.totals;
  return (
    <section className="sheet" aria-label={`Venda ${doc.code}`}>
      <SheetHeader company={doc.company} />
      <SheetTitle title={doc.title} code={doc.code} issuedOn={doc.issuedOn} />
      {doc.canceled ? <p style={{ color: '#b42318', fontWeight: 700, fontSize: '13pt', marginBottom: 6 }}>{doc.order ? 'PEDIDO CANCELADO' : 'VENDA CANCELADA'}</p> : null}
      {doc.demo ? <p style={{ color: '#b45309', fontWeight: 700, fontSize: '11pt', marginBottom: 6 }}>DEMONSTRAÇÃO — dados fictícios, sem valor como comprovante</p> : null}
      <SheetSection title="Cliente">
        <div className="sheet__grid">
          <Field label="Cliente" value={doc.customer.name} span={2} />
          <Field label="Data da venda" value={doc.saleDate} span={2} />
          <Field label="Contato" value={doc.customer.contact} span={2} />
          {/* Nos pedidos da loja o endereço de entrega já aparece no bloco do pedido, logo abaixo. */}
          {doc.order ? null : <Field label="Endereço" value={doc.customer.address} span={2} />}
        </div>
      </SheetSection>
      {doc.order ? (
        <SheetSection title="Pedido da loja online">
          <div className="sheet__grid">
            <Field label="Pedido" value={doc.order.code} />
            <Field label="Recebido em" value={doc.order.placedAt} />
            <Field label="Como receber" value={doc.order.fulfillment} />
            <Field label="Situação do pedido" value={doc.order.status} />
            <Field label="Pagamento" value={doc.order.payment} span={2} />
            <Field label="Venda vinculada" value={doc.order.saleCode} />
            {doc.order.email ? <Field label="E-mail do cliente" value={doc.order.email} span={2} /> : null}
            {doc.order.isDelivery ? <Field label="Endereço de entrega" value={doc.order.deliveryAddress} span={4} /> : null}
            {doc.order.buyerNotes ? <Field label="Observações do cliente" value={doc.order.buyerNotes} span={4} /> : null}
          </div>
        </SheetSection>
      ) : null}
      <SheetSection title="Produtos">
        <table className="sheet__table">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="num" style={{ width: '9%' }}>
                Qtd.
              </th>
              <th className="num" style={{ width: '18%' }}>
                Unitário
              </th>
              <th className="num" style={{ width: '18%' }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, i) => (
              <tr key={i}>
                <td>{item.description}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{formatBRL(item.unitPriceCents)}</td>
                <td className="num">
                  <b>{formatBRL(item.totalCents)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SheetSection>
      <div className="sheet__totals">
        {t.discountCents > 0 ? (
          <>
            <div>
              <span>Subtotal</span>
              <b>{formatBRL(t.subtotalCents)}</b>
            </div>
            <div className="neg">
              <span>Desconto</span>
              <b>−{formatBRL(t.discountCents)}</b>
            </div>
          </>
        ) : null}
        <div className="grand">
          <span>Valor total</span>
          <b>{formatBRL(t.totalCents)}</b>
        </div>
        {t.paidCents > 0 ? (
          <div>
            <span>Recebido</span>
            <b style={{ color: 'var(--green-700)' }}>{formatBRL(t.paidCents)}</b>
          </div>
        ) : null}
        {t.paidCents > 0 && t.balanceCents > 0 ? (
          <div className="neg">
            <span>Saldo a receber</span>
            <b>{formatBRL(t.balanceCents)}</b>
          </div>
        ) : null}
      </div>
      <div className="sheet__grid" style={{ marginTop: 10 }}>
        {doc.payments.length > 0 ? <Field label="Pagamentos recebidos" value={doc.payments.map((p) => `${p.date} — ${p.method}: ${formatBRL(p.amountCents)}`).join('\n')} span={4} /> : null}
        {doc.notes ? <Field label="Observações" value={doc.notes} span={4} /> : null}
      </div>
      <div className="sheet__spacer" />
      <SheetFooter company={doc.company} page={1} pages={1} />
    </section>
  );
}
