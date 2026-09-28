/**
 * Modelo de documento: dados já formatados e prontos para exibir. Os renderizadores (página A4 para impressão
 * e PDF) consomem exatamente o mesmo modelo, garantindo documentos idênticos. Os dados da empresa vêm sempre
 * de Configurações (nada fixo no código).
 */
import { ORDER_STATUS } from '@/config/order-status';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/config/payment-methods';
import { FULFILLMENT_LABEL, STORE_ORDER_STATUS, storePaymentLabel, type Fulfillment, type StorePaymentMethod } from '@/config/store';
import { formatOrderCode, formatReceiptCode, formatSaleCode, formatStoreOrderCode } from '@/lib/codes';
import { dateOnlyInTimezone, formatDateBR, formatDateTimeBR } from '@/lib/dates';
import { formatCpfCnpj } from '@/lib/document-id';
import { cityLine, groupBusinessHours, instagramHandle, phoneDisplay, streetLine } from '@/lib/company';
import { moneyToWords } from '@/lib/money-words';
import { displayPhone } from '@/lib/phone';
import { computeOrderTotals } from '@/lib/order-totals';
import { joinParts } from '@/lib/text';
import { parseTermsMarkup, type TermsBlock } from '@/lib/terms-markup';
import { NotFoundError } from '../auth/errors';
import type { CompanySettings } from '../db/schema';
import { getFile } from '../services/files';
import { getOrderDetail } from '../services/orders';
import { getPayment } from '../services/payments';
import { getSaleDetail } from '../services/sales';
import { getActiveGuaranteeTerms, getCompanySettings } from '../services/settings';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { customers } from '../db/schema';

export interface DocumentCompany {
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string;
  whatsapp: string | null;
  street: string;
  city: string;
  instagram: string;
  hours: { label: string; value: string }[];
  logoFileId: number | null;
}

export interface DocumentLogo {
  data: Buffer;
  mimeType: string;
}

export function toDocumentCompany(company: CompanySettings): DocumentCompany {
  const like = { ...company, hours: company.hours };
  return {
    name: company.name,
    cnpj: company.cnpj,
    email: company.email,
    phone: phoneDisplay(like),
    whatsapp: company.whatsapp ? displayPhone(company.whatsapp.replace(/^55/, '')) : null,
    street: streetLine(like),
    city: cityLine(like),
    instagram: instagramHandle(like),
    hours: groupBusinessHours(company.hours).map((g) => ({ label: g.label, value: g.value })),
    logoFileId: company.logoFileId,
  };
}

export async function loadLogo(company: DocumentCompany): Promise<DocumentLogo | null> {
  if (!company.logoFileId) return null;
  const file = await getFile(company.logoFileId);
  return file ? { data: file.data, mimeType: file.mimeType } : null;
}

export interface DocumentTerms {
  title: string;
  months: number;
  blocks: TermsBlock[];
}

export interface OrderDocument {
  kind: 'ORDER';
  title: string;
  code: string;
  issuedOn: string;
  company: DocumentCompany;
  customer: { name: string; contact: string; address: string; document: string };
  equipment: string;
  brandModel: string;
  serviceDescription: string;
  problem: string;
  diagnosis: string;
  entryDate: string;
  expectedDate: string;
  deliveredDate: string;
  nextServiceDate: string;
  statusLabel: string;
  paymentMethod: string;
  technician: string;
  notes: string;
  items: { kind: 'SERVICE' | 'PART'; description: string; quantity: number; unitPriceCents: number; totalCents: number }[];
  totals: { partsTotalCents: number; laborTotalCents: number; discountCents: number; totalCents: number; paidCents: number; balanceCents: number };
  payments: { date: string; method: string; amountCents: number }[];
  terms: DocumentTerms;
}

export async function buildOrderDocument(orderId: number): Promise<OrderDocument> {
  const detail = await getOrderDetail(orderId);
  if (!detail) throw new NotFoundError('Ordem de serviço');
  const settings = await getCompanySettings();
  const company = toDocumentCompany(settings);
  const terms = detail.terms ?? (await getActiveGuaranteeTerms());
  const { order, customer, items, technician } = detail;
  const totals = computeOrderTotals(items, order.discountCents);
  const paid = detail.payments.filter((p) => p.status === 'PAID');
  const fullyPaid = order.totalCents > 0 && detail.paidCents >= order.totalCents;

  return {
    kind: 'ORDER',
    title: fullyPaid ? 'ORDEM DE SERVIÇO / RECIBO' : 'ORDEM DE SERVIÇO',
    code: formatOrderCode(order.number),
    issuedOn: formatDateBR(dateOnlyInTimezone(new Date(), settings.timezone)),
    company,
    customer: {
      name: customer.name,
      contact: joinParts([displayPhone(customer.phone), customer.whatsapp && customer.whatsapp !== customer.phone ? `WhatsApp ${displayPhone(customer.whatsapp)}` : ''], ' · '),
      address: customer.address ?? '',
      document: customer.document ? formatCpfCnpj(customer.document) : '',
    },
    equipment: order.equipment,
    brandModel: joinParts([order.brand, order.model], ' · '),
    serviceDescription: order.serviceDescription?.trim() || order.problemDescription?.trim() || '',
    problem: order.problemDescription ?? '',
    diagnosis: order.diagnosis ?? '',
    entryDate: formatDateBR(order.entryDate),
    expectedDate: order.expectedDeliveryDate ? formatDateBR(order.expectedDeliveryDate) : '',
    deliveredDate: order.deliveredDate ? formatDateBR(order.deliveredDate) : '',
    nextServiceDate: order.nextServiceDate ? formatDateBR(order.nextServiceDate) : '',
    statusLabel: ORDER_STATUS[order.status].label,
    paymentMethod: order.paymentMethod ? PAYMENT_METHOD_LABEL[order.paymentMethod] : '',
    technician: technician?.name ?? '',
    notes: order.notes ?? '',
    items: items.map((i) => ({ kind: i.kind, description: i.description, quantity: i.quantity, unitPriceCents: i.unitPriceCents, totalCents: i.totalCents })),
    totals: {
      partsTotalCents: totals.partsTotalCents,
      laborTotalCents: totals.laborTotalCents,
      discountCents: totals.discountCents,
      totalCents: order.totalCents,
      paidCents: detail.paidCents,
      balanceCents: detail.balanceCents,
    },
    payments: paid.map((p) => ({ date: formatDateBR(p.paidDate), method: PAYMENT_METHOD_LABEL[p.method], amountCents: p.amountCents })),
    terms: { title: terms.title, months: terms.warrantyMonths, blocks: parseTermsMarkup(terms.content, terms.warrantyMonths) },
  };
}

export interface ReceiptDocument {
  kind: 'RECEIPT';
  title: string;
  code: string;
  issuedOn: string;
  company: DocumentCompany;
  payer: { name: string; document: string };
  amountCents: number;
  amountInWords: string;
  method: string;
  paidDate: string;
  reference: string;
  description: string;
  notes: string;
  /** Situação da OS/venda após este pagamento. */
  balanceAfterCents: number | null;
  totalCents: number | null;
}

export async function buildReceiptDocument(paymentId: number): Promise<ReceiptDocument> {
  const payment = await getPayment(paymentId);
  if (!payment) throw new NotFoundError('Pagamento');
  const settings = await getCompanySettings();
  const db = getDb();

  let payerName = 'Consumidor final';
  let payerDocument = '';
  if (payment.customerId) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, payment.customerId)).limit(1);
    if (customer) {
      payerName = customer.name;
      payerDocument = customer.document ? formatCpfCnpj(customer.document) : '';
    }
  }

  let reference = payment.description;
  let totalCents: number | null = null;
  let balanceAfterCents: number | null = null;
  if (payment.orderId) {
    const detail = await getOrderDetail(payment.orderId);
    if (detail) {
      reference = `${formatOrderCode(detail.order.number)} — ${detail.order.equipment}`;
      totalCents = detail.order.totalCents;
      // saldo após este pagamento = total − pagamentos não estornados até este (por data/id)
      const upTo = detail.payments.filter((p) => p.status === 'PAID' && (p.paidDate < payment.paidDate || (p.paidDate === payment.paidDate && p.id <= payment.id)));
      balanceAfterCents = Math.max(0, detail.order.totalCents - upTo.reduce((s, p) => s + p.amountCents, 0));
    }
  } else if (payment.saleId) {
    const sale = await getSaleDetail(payment.saleId);
    if (sale) {
      reference = `${formatSaleCode(sale.sale.number)} — venda de produtos`;
      totalCents = sale.sale.totalCents;
      // Pedido da loja virtual sem cliente cadastrado: o recibo sai no nome de quem comprou.
      if (!payment.customerId && sale.storeOrder) payerName = sale.storeOrder.buyerName;
      const upTo = sale.payments.filter((p) => p.status === 'PAID' && (p.paidDate < payment.paidDate || (p.paidDate === payment.paidDate && p.id <= payment.id)));
      balanceAfterCents = Math.max(0, sale.sale.totalCents - upTo.reduce((s, p) => s + p.amountCents, 0));
    }
  }

  return {
    kind: 'RECEIPT',
    title: 'RECIBO DE PAGAMENTO',
    code: formatReceiptCode(payment.id),
    issuedOn: formatDateBR(dateOnlyInTimezone(new Date(), settings.timezone)),
    company: toDocumentCompany(settings),
    payer: { name: payerName, document: payerDocument },
    amountCents: payment.amountCents,
    amountInWords: moneyToWords(payment.amountCents),
    method: PAYMENT_METHOD_LABEL[payment.method as PaymentMethod],
    paidDate: formatDateBR(payment.paidDate),
    reference,
    description: payment.description,
    notes: payment.notes ?? '',
    balanceAfterCents,
    totalCents,
  };
}

/** Dados do pedido da loja virtual impressos na folha (o que a equipe precisa para separar e entregar). */
export interface SaleDocumentOrder {
  /** Código do pedido na loja (LJ-000123). */
  code: string;
  /** Venda vinculada (VD-000045), para conferência no financeiro. */
  saleCode: string;
  /** Data e hora em que o cliente finalizou o pedido. */
  placedAt: string;
  /** "Retirada na loja" ou "Entrega". */
  fulfillment: string;
  isDelivery: boolean;
  /** Endereço de entrega (vazio na retirada). */
  deliveryAddress: string;
  /** Forma e situação do pagamento (ex.: "PIX — aguardando confirmação do pagamento"). */
  payment: string;
  status: string;
  email: string;
  /** Observação escrita pelo cliente no checkout. */
  buyerNotes: string;
}

export interface SaleDocument {
  kind: 'SALE';
  title: string;
  code: string;
  issuedOn: string;
  saleDate: string;
  company: DocumentCompany;
  customer: { name: string; contact: string; address: string };
  items: { description: string; quantity: number; unitPriceCents: number; totalCents: number }[];
  totals: { subtotalCents: number; discountCents: number; totalCents: number; paidCents: number; balanceCents: number };
  payments: { date: string; method: string; amountCents: number }[];
  notes: string;
  canceled: boolean;
  /** Registro de DEMONSTRAÇÃO: o documento sai marcado e não vale como comprovante. */
  demo: boolean;
  /** Preenchido quando a venda veio da loja virtual. */
  order: SaleDocumentOrder | null;
}

/** CEP com hífen quando tem 8 números ("50000000" → "50000-000"). */
function formatZip(zip: string): string {
  const digits = zip.replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : zip;
}

export async function buildSaleDocument(saleId: number): Promise<SaleDocument> {
  const detail = await getSaleDetail(saleId);
  if (!detail) throw new NotFoundError('Venda');
  const settings = await getCompanySettings();
  const { sale, customer, items, payments, storeOrder } = detail;
  const paid = payments.filter((p) => p.status === 'PAID');
  const deliveryAddress = storeOrder?.deliveryAddress;
  const deliveryText = deliveryAddress
    ? joinParts([`${deliveryAddress.street}, ${deliveryAddress.number}`, deliveryAddress.complement, deliveryAddress.district, `${deliveryAddress.city}/${deliveryAddress.state}`, deliveryAddress.zip ? `CEP ${formatZip(deliveryAddress.zip)}` : null], ' - ')
    : '';
  const paidCents = paid.reduce((s, p) => s + p.amountCents, 0);
  const subtotal = items.reduce((s, i) => s + i.totalCents, 0);
  const balanceCents = Math.max(0, sale.totalCents - paidCents);
  const isPaid = paidCents > 0 && balanceCents === 0;

  const order: SaleDocumentOrder | null = storeOrder
    ? {
        code: formatStoreOrderCode(storeOrder.number),
        saleCode: formatSaleCode(sale.number),
        placedAt: formatDateTimeBR(storeOrder.createdAt, settings.timezone),
        fulfillment: FULFILLMENT_LABEL[storeOrder.fulfillment],
        isDelivery: storeOrder.fulfillment === 'DELIVERY',
        deliveryAddress: storeOrder.fulfillment === 'DELIVERY' ? deliveryText : '',
        payment: storeOrderPaymentText(storeOrder.paymentMethod, storeOrder.fulfillment, isPaid),
        status: STORE_ORDER_STATUS[storeOrder.status].label,
        email: storeOrder.buyerEmail ?? '',
        buyerNotes: storeOrder.notes ?? '',
      }
    : null;

  return {
    kind: 'SALE',
    title: order ? 'PEDIDO DA LOJA ONLINE' : 'COMPROVANTE DE VENDA',
    code: order ? order.code : formatSaleCode(sale.number),
    issuedOn: formatDateBR(dateOnlyInTimezone(new Date(), settings.timezone)),
    saleDate: formatDateBR(sale.saleDate),
    company: toDocumentCompany(settings),
    customer: {
      name: customer?.name ?? storeOrder?.buyerName ?? 'Consumidor final',
      contact: customer ? joinParts([displayPhone(customer.phone)], ' · ') : storeOrder ? displayPhone(storeOrder.buyerPhone) : '',
      // Na entrega vale o endereço informado no pedido (o do cadastro do cliente pode ser outro).
      address: (order?.isDelivery ? deliveryText : null) || (customer?.address ?? deliveryText),
    },
    items: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPriceCents: i.unitPriceCents, totalCents: i.totalCents })),
    totals: { subtotalCents: subtotal, discountCents: sale.discountCents, totalCents: sale.totalCents, paidCents, balanceCents },
    payments: paid.map((p) => ({ date: formatDateBR(p.paidDate), method: PAYMENT_METHOD_LABEL[p.method], amountCents: p.amountCents })),
    // Nos pedidos da loja a observação da venda é só um resumo automático do que o bloco "Pedido da loja online" já mostra.
    notes: order ? '' : (sale.notes ?? ''),
    canceled: sale.status === 'CANCELED',
    demo: sale.isDemo,
    order,
  };
}

function storeOrderPaymentText(method: StorePaymentMethod, fulfillment: Fulfillment, isPaid: boolean): string {
  const label = storePaymentLabel(method, fulfillment);
  if (isPaid) return `${label} — pago`;
  return method === 'PIX' ? `${label} — aguardando confirmação do pagamento` : `${label} — a receber`;
}
