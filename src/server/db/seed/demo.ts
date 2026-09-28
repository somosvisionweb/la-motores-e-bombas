/**
 * Dados de DEMONSTRAÇÃO — 100% fictícios, apenas para conhecer o sistema.
 * Todos os registros recebem `is_demo = true`, nomes com "[DEMO]" e telefones inexistentes ((81) 9000-000X),
 * e NUNCA alteram o estoque real. Podem ser removidos em bloco (Configurações → Dados de demonstração
 * ou `npm run db:demo:clear`). Os preços aqui são inventados apenas para o exemplo.
 */
import { eq, inArray } from 'drizzle-orm';
import type { PaymentMethod } from '../../../config/payment-methods';
import type { OrderStatus } from '../../../config/order-status';
import { addDaysISO, todayISO, zonedDayBoundMs } from '../../../lib/dates';
import type { Actor } from '../../auth/types';
import { withoutAudit } from '../../services/audit';
import { createCustomer } from '../../services/customers';
import { createExpense } from '../../services/expenses';
import { createOrder } from '../../services/orders';
import { registerPayment } from '../../services/payments';
import { createSale } from '../../services/sales';
import { cancelStoreOrder, changeStoreOrderStatus, confirmStorePayment, placeStoreOrder } from '../../services/store-orders';
import { getDb, runWrite } from '../client';
import { companySettings, expenseCategories, products, serviceOrders, users } from '../schema';

/** Gerador pseudoaleatório determinístico (os mesmos dados a cada execução). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMERS = [
  { name: '[DEMO] João da Silva', document: null, address: 'Rua Exemplo, 100 - Bairro Demo, Jaboatão dos Guararapes/PE' },
  { name: '[DEMO] Maria Souza', document: '529.982.247-25', address: 'Av. Modelo, 250 - Centro Demo' },
  { name: '[DEMO] Pedro Almeida', document: null, address: 'Rua das Flores Demo, 45' },
  { name: '[DEMO] Oficina Modelo Ltda', document: '11.222.333/0001-81', address: 'Rod. Demonstração, km 3' },
  { name: '[DEMO] Ana Beatriz Costa', document: null, address: 'Rua do Exemplo, 88 - Apto 302' },
  { name: '[DEMO] Carlos Eduardo Lima', document: null, address: 'Travessa Demo, 12' },
  { name: '[DEMO] Padaria Exemplo', document: '11.444.777/0001-61', address: 'Av. Fictícia, 900 - Loja 2' },
  { name: '[DEMO] Fernanda Oliveira', document: null, address: 'Rua Teste, 300' },
  { name: '[DEMO] Roberto Santos', document: null, address: 'Sítio Demonstração, s/n' },
  { name: '[DEMO] Condomínio Residencial Demo', document: null, address: 'Rua Modelo, 1000' },
];

interface Template {
  equipment: string;
  brand: string | null;
  service: string;
  problem: string;
  labor: [number, number];
  part?: { name: string; qty: number; price: [number, number] };
}

const TEMPLATES: Template[] = [
  { equipment: 'Motor elétrico 1/2 cv', brand: 'WEG', service: 'Rebobinamento de motores elétricos', problem: 'Motor não parte e esquenta.', labor: [180, 320], part: { name: 'Rolamentos', qty: 2, price: [28, 45] } },
  { equipment: 'Bomba d’água centrífuga', brand: 'Schneider', service: 'Manutenção de bombas centrífugas', problem: 'Vazamento pelo eixo.', labor: [90, 160], part: { name: 'Selo mecânico', qty: 1, price: [45, 90] } },
  { equipment: 'Bomba submersa', brand: null, service: 'Manutenção de bombas submersas', problem: 'Não puxa água.', labor: [120, 220], part: { name: 'Capacitor permanente', qty: 1, price: [30, 60] } },
  { equipment: 'Máquina de costura industrial', brand: 'Singer', service: 'Manutenção de motores de máquinas de costura', problem: 'Motor fraco e barulhento.', labor: [80, 140], part: { name: 'Polia', qty: 1, price: [25, 45] } },
  { equipment: 'Exaustor', brand: null, service: 'Manutenção de exaustores', problem: 'Hélice trava.', labor: [70, 130], part: { name: 'Ventoinha', qty: 1, price: [40, 85] } },
  { equipment: 'Ventilador de parede', brand: 'Ventisol', service: 'Manutenção de ventiladores', problem: 'Não gira na velocidade máxima.', labor: [60, 110], part: { name: 'Capacitor permanente', qty: 1, price: [22, 40] } },
  { equipment: 'Liquidificador industrial', brand: null, service: 'Manutenção de liquidificador industrial', problem: 'Faz ruído e perde potência.', labor: [110, 190], part: { name: 'Rolamentos', qty: 2, price: [30, 50] } },
  { equipment: 'Bomba de piscina', brand: 'Sodramar', service: 'Manutenção de bombas de piscina', problem: 'Aquece e desarma.', labor: [140, 240], part: { name: 'Selo mecânico', qty: 1, price: [55, 110] } },
  { equipment: 'Motor compressor', brand: null, service: 'Manutenção de motor compressor', problem: 'Não parte com carga.', labor: [150, 260], part: { name: 'Platinado', qty: 1, price: [35, 70] } },
  { equipment: 'Forrageira', brand: null, service: 'Manutenção de forrageira', problem: 'Motor desarma o disjuntor.', labor: [200, 380] },
  { equipment: 'Bomba periférica', brand: 'Dancor', service: 'Manutenção de bombas periféricas', problem: 'Pressão baixa.', labor: [100, 180], part: { name: 'Rotor', qty: 1, price: [60, 120] } },
  { equipment: 'Motor de ar-condicionado', brand: null, service: 'Manutenção de motores de ar-condicionado', problem: 'Ventoinha não gira.', labor: [90, 160], part: { name: 'Capacitor eletrolítico', qty: 1, price: [28, 55] } },
  { equipment: 'Esmeril', brand: null, service: 'Manutenção de esmeril', problem: 'Vibração excessiva.', labor: [70, 120], part: { name: 'Rolamentos', qty: 2, price: [26, 42] } },
  { equipment: 'Bomba injetora', brand: null, service: 'Manutenção de bombas injetoras', problem: 'Não parte.', labor: [130, 210] },
];

/**
 * Preços FICTÍCIOS da loja virtual (só para demonstração): ficam em `demo_price_cents`, nunca em `sale_price_cents`,
 * e somem junto com os demais dados de demonstração. O preço real é cadastrado pela empresa em Produtos.
 */
const DEMO_PRODUCT_PRICES: Record<string, number> = {
  Rolamentos: 38,
  'Selo mecânico': 68,
  'Capacitor permanente': 42,
  'Capacitor eletrolítico': 39,
  Centrífugo: 55,
  Platinado: 48,
  Ventoinha: 62,
  'Tampa intermediária': 74,
  'Tampa dianteira': 79,
  'Tampa traseira': 79,
  Manômetro: 46,
  Polia: 35,
  Rotor: 96,
};

/** Pedidos de exemplo da loja virtual (todos de demonstração e sem tocar no estoque). */
const STORE_ORDER_PLANS: { buyer: string; payment: 'PIX' | 'ON_SITE'; items: [string, number][]; steps: ('CONFIRM_PIX' | 'CONFIRMED' | 'READY' | 'COMPLETED' | 'CANCELED')[] }[] = [
  { buyer: 'Loja Cliente A', payment: 'PIX', items: [['Capacitor permanente', 2], ['Rolamentos', 4]], steps: [] },
  { buyer: 'Loja Cliente B', payment: 'ON_SITE', items: [['Polia', 1]], steps: ['CONFIRMED'] },
  { buyer: 'Loja Cliente C', payment: 'PIX', items: [['Selo mecânico', 1], ['Manômetro', 1]], steps: ['CONFIRM_PIX', 'READY'] },
  { buyer: 'Loja Cliente D', payment: 'ON_SITE', items: [['Ventoinha', 1], ['Capacitor eletrolítico', 2]], steps: ['CONFIRMED', 'READY', 'COMPLETED'] },
  { buyer: 'Loja Cliente E', payment: 'PIX', items: [['Rotor', 1]], steps: ['CANCELED'] },
];

const METHODS: PaymentMethod[] = ['PIX', 'PIX', 'PIX', 'DINHEIRO', 'DINHEIRO', 'CARTAO', 'CARTAO', 'BOLETO'];

interface OrderPlan {
  daysAgo: number;
  status: OrderStatus;
  /** 'full' | 'partial' | 'none' */
  pay: 'full' | 'partial' | 'none';
  expected?: number; // dias a partir de hoje (negativo = vencido)
  nextService?: number;
}

const PLANS: OrderPlan[] = [
  ...[68, 61, 55, 49, 44, 40, 36, 31, 27, 23, 19, 15].map((daysAgo, i): OrderPlan => ({ daysAgo, status: 'ENTREGUE', pay: i === 5 ? 'partial' : 'full' })),
  { daysAgo: 33, status: 'CANCELADO', pay: 'none' },
  { daysAgo: 12, status: 'ENTREGUE', pay: 'full', nextService: 5 },
  { daysAgo: 9, status: 'PRONTO', pay: 'none' },
  { daysAgo: 7, status: 'PRONTO', pay: 'partial' },
  { daysAgo: 5, status: 'PRONTO', pay: 'full' },
  { daysAgo: 6, status: 'EM_MANUTENCAO', pay: 'partial', expected: -2 },
  { daysAgo: 4, status: 'EM_MANUTENCAO', pay: 'none', expected: 1 },
  { daysAgo: 3, status: 'AGUARDANDO_PECA', pay: 'none', expected: 4 },
  { daysAgo: 3, status: 'AGUARDANDO_APROVACAO', pay: 'none', expected: 6 },
  { daysAgo: 2, status: 'ORCAMENTO_ENVIADO', pay: 'none', expected: 7 },
  { daysAgo: 2, status: 'EM_ANALISE', pay: 'none', expected: 5 },
  { daysAgo: 1, status: 'AGUARDANDO_AVALIACAO', pay: 'none', expected: 8 },
  { daysAgo: 0, status: 'AGUARDANDO_AVALIACAO', pay: 'none' },
];

const EXPENSES: { daysAgo: number; description: string; supplier: string | null; category: string; value: number; method: PaymentMethod | null }[] = [
  { daysAgo: 66, description: 'Compra de rolamentos (lote)', supplier: '[DEMO] Distribuidora Elétrica', category: 'Mercadorias', value: 420, method: 'PIX' },
  { daysAgo: 58, description: 'Compra de capacitores', supplier: '[DEMO] Distribuidora Elétrica', category: 'Mercadorias', value: 310, method: 'BOLETO' },
  { daysAgo: 52, description: 'Ferramenta de bancada', supplier: '[DEMO] Casa das Ferramentas', category: 'Ferramentas e equipamentos', value: 260, method: 'CARTAO' },
  { daysAgo: 45, description: 'Selos mecânicos', supplier: '[DEMO] Bombas & Cia', category: 'Mercadorias', value: 380, method: 'PIX' },
  { daysAgo: 40, description: 'Despesas do mês (demonstração)', supplier: null, category: 'Despesas fixas', value: 650, method: 'PIX' },
  { daysAgo: 34, description: 'Combustível para atendimentos', supplier: '[DEMO] Posto Exemplo', category: 'Transporte', value: 140, method: 'DINHEIRO' },
  { daysAgo: 28, description: 'Compra de polias e ventoinhas', supplier: '[DEMO] Distribuidora Elétrica', category: 'Mercadorias', value: 295, method: 'PIX' },
  { daysAgo: 21, description: 'Taxas e impostos (demonstração)', supplier: null, category: 'Impostos e taxas', value: 210, method: 'BOLETO' },
  { daysAgo: 16, description: 'Despesas do mês (demonstração)', supplier: null, category: 'Despesas fixas', value: 650, method: 'PIX' },
  { daysAgo: 11, description: 'Compra de platinados e rotores', supplier: '[DEMO] Bombas & Cia', category: 'Mercadorias', value: 340, method: 'PIX' },
  { daysAgo: 6, description: 'Combustível para atendimentos', supplier: '[DEMO] Posto Exemplo', category: 'Transporte', value: 120, method: 'DINHEIRO' },
  { daysAgo: 3, description: 'Material de consumo', supplier: '[DEMO] Casa das Ferramentas', category: 'Outros', value: 85, method: 'CARTAO' },
];

export interface DemoSeedResult {
  customers: number;
  orders: number;
  payments: number;
  expenses: number;
  sales: number;
  storeOrders: number;
}

/**
 * Cria os dados de demonstração (remove os anteriores antes, para não duplicar).
 * A criação não gera trilha de auditoria: registros fictícios não são ações reais de ninguém.
 */
export async function seedDemoData(): Promise<DemoSeedResult> {
  const { clearDemoData } = await import('../../services/demo');
  await clearDemoData();
  return withoutAudit(insertDemoData);
}

async function insertDemoData(): Promise<DemoSeedResult> {
  const db = getDb();
  const [settings] = await db.select().from(companySettings).limit(1);
  if (!settings) throw new Error('Execute o seed oficial antes (npm run db:seed).');
  const timezone = settings.timezone;
  const today = todayISO(timezone);

  const [admin] = await db.select().from(users).where(eq(users.username, 'ewerton')).limit(1);
  if (!admin) throw new Error('Usuário administrador não encontrado. Execute o seed oficial antes (npm run db:seed).');
  const actor: Actor = { id: admin.id, name: admin.name };
  const staff = await db.select({ id: users.id }).from(users).where(inArray(users.username, ['ewerton', 'mario']));

  const random = mulberry32(20260924);
  const between = (min: number, max: number) => Math.round(min + random() * (max - min));
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)]!;
  const noon = (iso: string) => new Date(zonedDayBoundMs(iso, timezone, 'start') + 12 * 3_600_000);

  const productRows = await db.select({ id: products.id, name: products.name }).from(products);
  const productByName = new Map(productRows.map((p) => [p.name, p.id]));

  // Clientes
  const customerIds: number[] = [];
  for (const [index, c] of CUSTOMERS.entries()) {
    const phone = `(81) 9000-${String(index + 1).padStart(4, '0')}`;
    const created = await createCustomer(
      { name: c.name, phone, whatsapp: phone, document: c.document, email: null, address: c.address, notes: 'Cadastro fictício de demonstração.' },
      actor,
      { isDemo: true, createdAt: noon(addDaysISO(today, -(75 - index * 3))) },
    );
    customerIds.push(created.id);
  }

  // Ordens de serviço + pagamentos
  let paymentsCount = 0;
  let ordersCount = 0;
  for (const [index, plan] of PLANS.entries()) {
    const template = TEMPLATES[index % TEMPLATES.length]!;
    const entryDate = addDaysISO(today, -plan.daysAgo);
    const labor = between(template.labor[0], template.labor[1]) * 100;
    const items: Parameters<typeof createOrder>[0]['items'] = [{ kind: 'SERVICE', description: template.service, quantity: 1, unitPriceCents: labor }];
    if (template.part) {
      items.push({
        kind: 'PART',
        productId: productByName.get(template.part.name) ?? null,
        description: template.part.name,
        quantity: template.part.qty,
        unitPriceCents: between(template.part.price[0], template.part.price[1]) * 100,
      });
    }
    const discount = index % 7 === 3 ? 1000 : 0;
    const status = plan.status;
    const order = await createOrder(
      {
        customerId: customerIds[index % customerIds.length]!,
        equipment: template.equipment,
        brand: template.brand,
        model: null,
        problemDescription: template.problem,
        diagnosis: status === 'AGUARDANDO_AVALIACAO' ? null : 'Avaliação técnica concluída (demonstração).',
        serviceDescription: ['ENTREGUE', 'PRONTO'].includes(status) ? `${template.service} — serviço executado e testado.` : null,
        entryDate,
        expectedDeliveryDate: plan.expected !== undefined ? addDaysISO(today, plan.expected) : addDaysISO(entryDate, 5),
        nextServiceDate: plan.nextService !== undefined ? addDaysISO(today, plan.nextService) : null,
        technicianId: pick(staff).id,
        paymentMethod: pick(METHODS),
        discountCents: discount,
        notes: null,
        items,
      },
      actor,
      { isDemo: true, status, createdAt: noon(entryDate) },
    );
    ordersCount++;

    // datas de conclusão/entrega mais realistas que "no mesmo dia"
    let paidDate = entryDate;
    if (status === 'ENTREGUE' || status === 'PRONTO') {
      const clamp = (iso: string) => (iso > today ? today : iso);
      const completed = clamp(addDaysISO(entryDate, between(2, 5)));
      const delivered = status === 'ENTREGUE' ? clamp(addDaysISO(completed, between(0, 2))) : null;
      await runWrite((tx) => tx.update(serviceOrders).set({ completedDate: completed, deliveredDate: delivered }).where(eq(serviceOrders.id, order.id)));
      paidDate = delivered ?? completed;
    }

    if (plan.pay !== 'none' && status !== 'CANCELADO') {
      const method = pick(METHODS);
      if (plan.pay === 'full') {
        await registerPayment({ orderId: order.id, amountCents: order.totalCents, method, paidDate }, actor, { isDemo: true, createdAt: noon(paidDate) });
        paymentsCount++;
      } else {
        const first = Math.round((order.totalCents * 0.4) / 100) * 100;
        await registerPayment({ orderId: order.id, amountCents: Math.max(100, first), method, paidDate }, actor, { isDemo: true, createdAt: noon(paidDate) });
        paymentsCount++;
      }
    }
    if (status === 'CANCELADO') {
      await runWrite((tx) =>
        tx.update(serviceOrders).set({ canceledAt: noon(addDaysISO(entryDate, 1)), cancelReason: 'Cliente desistiu do reparo (demonstração).' }).where(eq(serviceOrders.id, order.id)),
      );
    }
  }

  // Vendas de balcão
  const saleProducts = ['Rolamentos', 'Capacitor permanente', 'Ventoinha', 'Polia', 'Manômetro', 'Selo mecânico', 'Capacitor eletrolítico', 'Rotor'];
  let salesCount = 0;
  for (let i = 0; i < 8; i++) {
    const saleDate = addDaysISO(today, -between(1, 60));
    const first = saleProducts[i % saleProducts.length]!;
    const second = saleProducts[(i + 3) % saleProducts.length]!;
    await createSale(
      {
        customerId: i % 3 === 0 ? customerIds[i % customerIds.length]! : null,
        saleDate,
        discountCents: 0,
        notes: null,
        items: [
          { productId: productByName.get(first) ?? null, description: first, quantity: between(1, 3), unitPriceCents: between(20, 90) * 100 },
          ...(i % 2 === 0 ? [{ productId: productByName.get(second) ?? null, description: second, quantity: 1, unitPriceCents: between(25, 110) * 100 }] : []),
        ],
        payment: { method: pick(METHODS), paidDate: saleDate },
      },
      actor,
      { isDemo: true, createdAt: noon(saleDate) },
    );
    salesCount++;
    paymentsCount++;
  }

  // Loja virtual: preços fictícios de demonstração + pedidos de exemplo em vários status
  for (const [name, reais] of Object.entries(DEMO_PRODUCT_PRICES)) {
    await runWrite((tx) => tx.update(products).set({ demoPriceCents: reais * 100 }).where(eq(products.name, name)));
  }
  let storeOrdersCount = 0;
  for (const [index, plan] of STORE_ORDER_PLANS.entries()) {
    const placed = await placeStoreOrder(
      {
        items: plan.items.map(([name, quantity]) => ({ productId: productByName.get(name)!, quantity })),
        buyer: { name: `[DEMO] ${plan.buyer}`, phone: `(81) 9000-01${String(index + 1).padStart(2, '0')}`, email: null },
        fulfillment: 'PICKUP',
        address: null,
        paymentMethod: plan.payment,
        notes: null,
      },
      { notify: false },
    );
    storeOrdersCount++;
    paymentsCount += plan.steps.includes('COMPLETED') || plan.steps.includes('CONFIRM_PIX') ? 1 : 0;
    for (const step of plan.steps) {
      if (step === 'CONFIRM_PIX') await confirmStorePayment(placed.id, actor, 'PIX');
      else if (step === 'CANCELED') await cancelStoreOrder(placed.id, 'Cliente desistiu (demonstração).', actor);
      else if (step === 'COMPLETED') await changeStoreOrderStatus(placed.id, 'COMPLETED', actor, { paymentMethod: 'DINHEIRO' });
      else await changeStoreOrderStatus(placed.id, step, actor);
    }
  }

  // Custos
  const categories = await db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories);
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));
  let expensesCount = 0;
  for (const expense of EXPENSES) {
    const categoryId = categoryByName.get(expense.category);
    if (!categoryId) continue;
    const date = addDaysISO(today, -expense.daysAgo);
    await createExpense(
      { date, description: expense.description, supplier: expense.supplier, categoryId, amountCents: expense.value * 100, paymentMethod: expense.method, notes: null },
      actor,
      { isDemo: true, createdAt: noon(date) },
    );
    expensesCount++;
  }

  return { customers: customerIds.length, orders: ordersCount, payments: paymentsCount, expenses: expensesCount, sales: salesCount, storeOrders: storeOrdersCount };
}
