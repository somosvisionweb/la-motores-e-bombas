import { formatBRL } from '@/lib/money';
import type { TermsBlock } from '@/lib/terms-markup';
import { formatCell } from '../../services/reports';
import type { DocumentLogo, OrderDocument, ReceiptDocument, SaleDocument } from '../model';
import type { ReportDocument } from '../report';
import { COLORS, PdfWriter } from './writer';

function footerFor(company: { name: string; cnpj: string | null; street: string; city: string }): string {
  return [company.name, company.cnpj ? `CNPJ ${company.cnpj}` : '', [company.street, company.city].filter(Boolean).join(' - ')].filter(Boolean).join('  ·  ');
}

/** Termos de garantia (texto do cliente) em página própria, ao final da OS. */
function renderTerms(w: PdfWriter, terms: OrderDocument['terms']): void {
  const { doc } = w;
  w.ensureSpace(w.pageHeight); // força página nova
  w.y = w.margin;
  doc.font('displayBold').fontSize(15).fillColor(COLORS.navy).text(terms.title.toUpperCase(), w.margin, w.y, { characterSpacing: 1.2, width: w.contentWidth });
  doc.save().rect(w.margin, doc.y + 4, 64, 2).fill(COLORS.green).restore();
  w.y = doc.y + 16;

  const render = (block: TermsBlock) => {
    switch (block.type) {
      case 'clause':
        w.ensureSpace(40);
        w.y += 5;
        w.paragraph(block.text, { font: 'bold', size: 10, color: COLORS.navy, gap: 3 });
        break;
      case 'subheading':
        w.ensureSpace(50);
        w.y += 8;
        w.paragraph(block.text.toUpperCase(), { font: 'displayBold', size: 11.5, color: COLORS.navy, gap: 3 });
        break;
      case 'paragraph':
        w.paragraph(block.text, { size: 8.8, align: 'justify', gap: 5 });
        break;
      case 'bullets':
        for (const item of block.items) {
          doc.font('body').fontSize(8.8);
          const height = doc.heightOfString(item, { width: w.contentWidth - 18 });
          w.ensureSpace(height + 4);
          doc.fillColor(COLORS.greenDark).text('•', w.margin + 6, w.y, { lineBreak: false });
          doc.fillColor(COLORS.text).text(item, w.margin + 18, w.y, { width: w.contentWidth - 18, lineGap: 1.5 });
          w.y = doc.y + 2.5;
        }
        w.y += 3;
        break;
      case 'highlight': {
        w.ensureSpace(34);
        const y = w.y + 6;
        doc.save().roundedRect(w.margin, y, w.contentWidth, 24, 3).fill(COLORS.band).rect(w.margin, y, 4, 24).fill(COLORS.green).restore();
        doc.font('bold').fontSize(11).fillColor(COLORS.navy).text(block.text, w.margin + 14, y + 6.5, { width: w.contentWidth - 20, lineBreak: false });
        w.y = y + 32;
        break;
      }
    }
  };
  terms.blocks.forEach(render);
}

export async function renderOrderPdf(order: OrderDocument, logo: DocumentLogo | null): Promise<Buffer> {
  const w = new PdfWriter({ title: `${order.title} ${order.code}`, author: order.company.name, footerText: footerFor(order.company) });

  w.header(order.company, logo);
  w.titleBar(order.title, order.code, order.issuedOn);

  w.sectionTitle('Dados do cliente');
  w.keyValueGrid(
    [
      { label: 'Nome', value: order.customer.name },
      { label: 'CPF / CNPJ', value: order.customer.document },
      { label: 'Contato', value: order.customer.contact },
      { label: 'Endereço', value: order.customer.address },
    ],
    2,
  );

  w.sectionTitle('Serviço');
  w.keyValueGrid(
    [
      { label: 'Equipamento', value: [order.equipment, order.brandModel].filter(Boolean).join(' — '), span: 3 },
      { label: 'Situação', value: order.statusLabel },
      { label: 'Descrição do serviço', value: order.serviceDescription, span: 3 },
      { label: 'Valor', value: formatBRL(order.totals.totalCents) },
      { label: 'Data de entrada', value: order.entryDate },
      { label: 'Previsão de entrega', value: order.expectedDate },
      { label: 'Data de entrega', value: order.deliveredDate },
      { label: 'Próximo serviço previsto', value: order.nextServiceDate },
    ],
    4,
  );
  if (order.problem && order.problem !== order.serviceDescription) w.keyValueGrid([{ label: 'Problema relatado', value: order.problem }], 1);
  if (order.diagnosis) w.keyValueGrid([{ label: 'Diagnóstico', value: order.diagnosis }], 1);

  if (order.items.length > 0) {
    w.sectionTitle('Itens do atendimento');
    w.table(
      [
        { header: 'Tipo', width: 52 },
        { header: 'Descrição', width: 250 },
        { header: 'Qtd.', width: 36, align: 'right' },
        { header: 'Unitário', width: 72, align: 'right' },
        { header: 'Total', width: 76, align: 'right' },
      ],
      order.items.map((i) => [i.kind === 'SERVICE' ? 'Serviço' : 'Peça', i.description, String(i.quantity), formatBRL(i.unitPriceCents), { text: formatBRL(i.totalCents), bold: true }]),
    );
  }

  const t = order.totals;
  w.totals([
    ...(t.partsTotalCents > 0 ? [{ label: 'Peças', value: formatBRL(t.partsTotalCents) }] : []),
    ...(t.laborTotalCents > 0 ? [{ label: 'Mão de obra / serviços', value: formatBRL(t.laborTotalCents) }] : []),
    ...(t.discountCents > 0 ? [{ label: 'Desconto', value: `−${formatBRL(t.discountCents)}`, color: COLORS.danger }] : []),
    { label: 'Valor total', value: formatBRL(t.totalCents), strong: true },
    ...(t.paidCents > 0 ? [{ label: 'Recebido', value: formatBRL(t.paidCents), color: COLORS.greenDark }] : []),
    ...(t.paidCents > 0 && t.balanceCents > 0 ? [{ label: 'Saldo a receber', value: formatBRL(t.balanceCents), color: COLORS.danger }] : []),
  ]);

  if (order.payments.length > 0 || order.paymentMethod) {
    const parts = order.payments.map((p) => `${p.date} — ${p.method}: ${formatBRL(p.amountCents)}`);
    w.keyValueGrid([{ label: order.payments.length ? 'Pagamentos recebidos' : 'Forma de pagamento combinada', value: parts.length ? parts.join('\n') : order.paymentMethod }], 1);
  }
  if (order.notes) w.keyValueGrid([{ label: 'Observações', value: order.notes }], 1);

  w.sectionTitle('Responsável');
  w.signatures({ label: 'Assinatura do técnico responsável', name: order.technician }, { label: 'Assinatura do cliente', name: order.customer.name });

  renderTerms(w, order.terms);
  return w.finish();
}

export async function renderReceiptPdf(receipt: ReceiptDocument, logo: DocumentLogo | null): Promise<Buffer> {
  const w = new PdfWriter({ title: `${receipt.title} ${receipt.code}`, author: receipt.company.name, footerText: footerFor(receipt.company) });
  const { doc } = w;
  w.header(receipt.company, logo);
  w.titleBar(receipt.title, receipt.code, receipt.issuedOn);

  // valor em destaque
  const boxY = w.y;
  doc.save().roundedRect(w.margin, boxY, w.contentWidth, 64, 6).fill(COLORS.band).rect(w.margin, boxY, 5, 64).fill(COLORS.green).restore();
  doc.font('medium').fontSize(8).fillColor(COLORS.subtle).text('VALOR RECEBIDO', w.margin + 20, boxY + 10, { characterSpacing: 0.8 });
  doc.font('displayBold').fontSize(26).fillColor(COLORS.greenDark).text(formatBRL(receipt.amountCents), w.margin + 20, boxY + 22, { lineBreak: false });
  doc.font('body').fontSize(8.5).fillColor(COLORS.muted).text(`(${receipt.amountInWords})`, w.margin + 210, boxY + 27, { width: w.contentWidth - 230 });
  w.y = boxY + 64 + 18;

  w.paragraph(
    `Recebemos de ${receipt.payer.name}${receipt.payer.document ? ` (${receipt.payer.document})` : ''} a quantia de ${formatBRL(receipt.amountCents)} (${receipt.amountInWords}), referente a ${receipt.reference}, pago em ${receipt.method} no dia ${receipt.paidDate}.`,
    { size: 10.5, gap: 12 },
  );

  w.sectionTitle('Detalhes do pagamento');
  w.keyValueGrid(
    [
      { label: 'Pagador', value: receipt.payer.name },
      { label: 'Forma de pagamento', value: receipt.method },
      { label: 'Data do pagamento', value: receipt.paidDate },
      { label: 'Referente a', value: receipt.reference },
      ...(receipt.totalCents !== null ? [{ label: 'Valor total', value: formatBRL(receipt.totalCents) }] : []),
      ...(receipt.balanceAfterCents !== null ? [{ label: 'Saldo restante após este pagamento', value: formatBRL(receipt.balanceAfterCents) }] : []),
      ...(receipt.notes ? [{ label: 'Observações', value: receipt.notes, span: 2 }] : []),
    ],
    2,
  );

  w.y += 12;
  w.signatures({ label: `${receipt.company.name}`, name: 'Assinatura / carimbo' }, { label: receipt.payer.name, name: 'Assinatura do cliente' });
  return w.finish();
}

export async function renderReportPdf(report: ReportDocument, logo: DocumentLogo | null): Promise<Buffer> {
  const { data, company } = report;
  const w = new PdfWriter({ title: `${data.title} — ${report.periodLabel}`, author: company.name, footerText: footerFor(company) });
  w.header(company, logo);
  w.titleBar(data.title.toUpperCase(), null, report.issuedOn, `Período: ${report.periodLabel}`);
  w.kpis(data.kpis);

  for (const table of data.tables) {
    w.sectionTitle(table.title);
    const rows: (string | { text: string; bold?: boolean })[][] = table.rows.map((row) => row.map((cell, i) => formatCell(table.columns[i]!, cell)));
    if (table.footer) rows.push(table.footer.map((cell, i) => ({ text: formatCell(table.columns[i]!, cell) === '—' ? '' : formatCell(table.columns[i]!, cell), bold: true })));
    w.table(
      table.columns.map((c) => ({ header: c.header, width: (c.width ?? 1) * 60, align: c.align })),
      rows,
      { fontSize: 8.2 },
    );
    if (table.note) w.paragraph(table.note, { size: 7.8, color: COLORS.muted, gap: 6 });
  }
  return w.finish();
}

export async function renderSalePdf(sale: SaleDocument, logo: DocumentLogo | null): Promise<Buffer> {
  const w = new PdfWriter({ title: `${sale.title} ${sale.code}`, author: sale.company.name, footerText: footerFor(sale.company) });
  w.header(sale.company, logo);
  w.titleBar(sale.title, sale.code, sale.issuedOn);

  if (sale.canceled) {
    w.paragraph(sale.order ? 'PEDIDO CANCELADO' : 'VENDA CANCELADA', { font: 'displayBold', size: 14, color: COLORS.danger, gap: 8 });
  }
  if (sale.demo) {
    w.paragraph('DEMONSTRAÇÃO — dados fictícios, sem valor como comprovante', { font: 'displayBold', size: 11, color: COLORS.danger, gap: 8 });
  }
  w.sectionTitle('Cliente');
  w.keyValueGrid(
    [
      { label: 'Cliente', value: sale.customer.name },
      { label: 'Data da venda', value: sale.saleDate },
      { label: 'Contato', value: sale.customer.contact },
      // Nos pedidos da loja o endereço de entrega já aparece no bloco do pedido, logo abaixo.
      ...(sale.order ? [] : [{ label: 'Endereço', value: sale.customer.address }]),
    ],
    2,
  );

  if (sale.order) {
    w.sectionTitle('Pedido da loja online');
    w.keyValueGrid(
      [
        { label: 'Pedido', value: sale.order.code },
        { label: 'Recebido em', value: sale.order.placedAt },
        { label: 'Como receber', value: sale.order.fulfillment },
        { label: 'Situação do pedido', value: sale.order.status },
        { label: 'Pagamento', value: sale.order.payment },
        { label: 'Venda vinculada', value: sale.order.saleCode },
        ...(sale.order.email ? [{ label: 'E-mail do cliente', value: sale.order.email }] : []),
      ],
      2,
    );
    if (sale.order.isDelivery) w.keyValueGrid([{ label: 'Endereço de entrega', value: sale.order.deliveryAddress }], 1);
    if (sale.order.buyerNotes) w.keyValueGrid([{ label: 'Observações do cliente', value: sale.order.buyerNotes }], 1);
  }

  w.sectionTitle('Produtos');
  w.table(
    [
      { header: 'Produto', width: 300 },
      { header: 'Qtd.', width: 40, align: 'right' },
      { header: 'Unitário', width: 80, align: 'right' },
      { header: 'Total', width: 80, align: 'right' },
    ],
    sale.items.map((i) => [i.description, String(i.quantity), formatBRL(i.unitPriceCents), { text: formatBRL(i.totalCents), bold: true }]),
  );
  const t = sale.totals;
  w.totals([
    ...(t.discountCents > 0 ? [{ label: 'Subtotal', value: formatBRL(t.subtotalCents) }, { label: 'Desconto', value: `−${formatBRL(t.discountCents)}`, color: COLORS.danger }] : []),
    { label: 'Valor total', value: formatBRL(t.totalCents), strong: true },
    ...(t.paidCents > 0 ? [{ label: 'Recebido', value: formatBRL(t.paidCents), color: COLORS.greenDark }] : []),
    ...(t.balanceCents > 0 && t.paidCents > 0 ? [{ label: 'Saldo a receber', value: formatBRL(t.balanceCents), color: COLORS.danger }] : []),
  ]);
  if (sale.payments.length > 0) {
    w.keyValueGrid([{ label: 'Pagamentos recebidos', value: sale.payments.map((p) => `${p.date} — ${p.method}: ${formatBRL(p.amountCents)}`).join('\n') }], 1);
  }
  if (sale.notes) w.keyValueGrid([{ label: 'Observações', value: sale.notes }], 1);
  return w.finish();
}
