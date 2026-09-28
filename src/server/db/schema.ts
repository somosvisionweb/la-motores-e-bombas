/**
 * Esquema do banco de dados (Drizzle ORM · SQLite/libSQL).
 *
 * Convenções:
 *  - Valores monetários: inteiros em centavos (`*_cents`).
 *  - Datas "de negócio" (entrada, entrega, pagamento…): texto ISO `YYYY-MM-DD` no fuso da empresa.
 *  - Carimbos de tempo (`created_at`…): epoch em milissegundos (`Date` no TypeScript).
 *  - `is_demo`: marca registros de DEMONSTRAÇÃO (nunca misturados com dados reais; podem ser removidos em bloco).
 *  - `search_text`: texto normalizado (minúsculo, sem acento) usado nas buscas.
 */
import { relations, sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex, blob } from 'drizzle-orm/sqlite-core';
// Imports relativos de propósito: o drizzle-kit carrega este arquivo sem resolver o alias "@/".
import { ORDER_STATUS_KEYS } from '../../config/order-status';
import { ITEM_KIND_KEYS, PAYMENT_METHOD_KEYS, STOCK_REASON_KEYS } from '../../config/payment-methods';
import { FULFILLMENT_KEYS, PIX_KEY_TYPES, STORE_ORDER_STATUS_KEYS, STORE_PAYMENT_KEYS, type DeliveryAddress } from '../../config/store';
import type { BusinessHours, WhatsAppTemplates } from '../../config/company';

// ---------- helpers de coluna ----------
const pk = () => integer('id').primaryKey({ autoIncrement: true });
const ts = (name: string) => integer(name, { mode: 'timestamp_ms' });
const createdAt = () =>
  ts('created_at')
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  ts('updated_at')
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());
const bool = (name: string, def: boolean) => integer(name, { mode: 'boolean' }).notNull().default(def);
const money = (name: string) => integer(name).notNull().default(0);

// =====================================================================
// Acesso: perfis, usuários, sessões
// =====================================================================

export const roles = sqliteTable('roles', {
  id: pk(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  /** Lista de chaves de permissão (ver `config/permissions.ts`). */
  permissions: text('permissions', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  /** Perfis do sistema (admin/vendedor) não podem ser excluídos. */
  isSystem: bool('is_system', false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = sqliteTable(
  'users',
  {
    id: pk(),
    name: text('name').notNull(),
    /** Identificador de login, sempre em minúsculas. */
    username: text('username').notNull().unique(),
    email: text('email').unique(),
    /** Hash scrypt no formato `scrypt$N$r$p$salt$hash`. Nunca a senha em texto. */
    passwordHash: text('password_hash').notNull(),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    isActive: bool('is_active', true),
    mustChangePassword: bool('must_change_password', true),
    lastLoginAt: ts('last_login_at'),
    passwordChangedAt: ts('password_changed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('idx_users_role').on(t.roleId)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 do token do cookie (o token em si nunca é gravado). */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at')
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: ts('expires_at').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('idx_sessions_user').on(t.userId), index('idx_sessions_expires').on(t.expiresAt)],
);

/** Tentativas de login (controle de força bruta). */
export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    id: pk(),
    username: text('username').notNull(),
    ip: text('ip'),
    success: bool('success', false),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_login_attempts_user').on(t.username, t.createdAt),
    index('idx_login_attempts_ip').on(t.ip, t.createdAt),
  ],
);

// =====================================================================
// Arquivos (logo, imagens do site, fotos de produtos)
// =====================================================================

export const files = sqliteTable('files', {
  id: pk(),
  kind: text('kind', { enum: ['LOGO', 'SITE_IMAGE', 'PRODUCT_IMAGE'] }).notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  data: blob('data', { mode: 'buffer' }).notNull(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

/** Imagens reais exibidas no site (hero e galeria). Sem imagens, o site usa as ilustrações técnicas. */
export const siteImages = sqliteTable(
  'site_images',
  {
    id: pk(),
    fileId: integer('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    slot: text('slot', { enum: ['HERO', 'GALLERY'] }).notNull(),
    alt: text('alt').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('idx_site_images_slot').on(t.slot, t.sortOrder)],
);

// =====================================================================
// Configurações da empresa e termos de garantia
// =====================================================================

/** Linha única (id = 1). Todos os documentos e o site leem os dados daqui. */
export const companySettings = sqliteTable('company_settings', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  cnpj: text('cnpj'),
  email: text('email'),
  /** Somente dígitos, com DDI (ex.: 5581996405805). */
  whatsapp: text('whatsapp'),
  /** Telefone de contato exibido (pode ser o mesmo do WhatsApp). */
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  /** Com @ (ex.: @l.a_motores_e_bombas). */
  instagram: text('instagram'),
  hours: text('hours', { mode: 'json' }).$type<BusinessHours>().notNull(),
  /** Formas de pagamento aceitas (chaves de `PAYMENT_METHOD_KEYS`). */
  paymentMethods: text('payment_methods', { mode: 'json' }).$type<string[]>().notNull(),
  logoFileId: integer('logo_file_id').references(() => files.id, { onDelete: 'set null' }),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  /** URL pública do sistema (ex.: https://lamotoresebombas.com.br), usada em links de PDF e SEO. */
  publicBaseUrl: text('public_base_url'),
  timezone: text('timezone').notNull().default('America/Recife'),
  whatsappTemplates: text('whatsapp_templates', { mode: 'json' }).$type<WhatsAppTemplates>().notNull(),
  /** Política de privacidade (LGPD) publicada em /privacidade. Vazia = a página não existe e nenhum link é exibido. */
  privacyText: text('privacy_text'),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});

/** Termos de garantia versionados: editar cria uma nova versão ativa e preserva as anteriores. */
export const guaranteeTerms = sqliteTable('guarantee_terms', {
  id: pk(),
  version: integer('version').notNull().unique(),
  title: text('title').notNull(),
  warrantyMonths: integer('warranty_months').notNull(),
  /** Texto com marcação simples (ver `lib/terms-markup.ts`). Aceita o placeholder {{prazo_garantia}}. */
  content: text('content').notNull(),
  isActive: bool('is_active', false),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

// =====================================================================
// Clientes
// =====================================================================

export const customers = sqliteTable(
  'customers',
  {
    id: pk(),
    name: text('name').notNull(),
    phone: text('phone'),
    whatsapp: text('whatsapp'),
    /** CPF ou CNPJ (opcional). */
    document: text('document'),
    email: text('email'),
    address: text('address'),
    notes: text('notes'),
    searchText: text('search_text').notNull().default(''),
    isDemo: bool('is_demo', false),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('idx_customers_name').on(t.name), index('idx_customers_created').on(t.createdAt)],
);

// =====================================================================
// Catálogo: serviços e produtos
// =====================================================================

export const services = sqliteTable('services', {
  id: pk(),
  name: text('name').notNull().unique(),
  /** Agrupamento (Principais, Motores, Bombas, Outros equipamentos…). */
  category: text('category').notNull().default('Geral'),
  description: text('description'),
  /** Preço padrão opcional. Nulo = "a combinar" (nenhum preço é inventado). */
  defaultPriceCents: integer('default_price_cents'),
  isActive: bool('is_active', true),
  showOnSite: bool('show_on_site', true),
  sortOrder: integer('sort_order').notNull().default(0),
  searchText: text('search_text').notNull().default(''),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const products = sqliteTable(
  'products',
  {
    id: pk(),
    /** Código interno (PRD-0001…). Gerado automaticamente quando não informado. */
    code: text('code').unique(),
    name: text('name').notNull().unique(),
    category: text('category').notNull().default('Componentes'),
    salePriceCents: money('sale_price_cents'),
    costCents: money('cost_cents'),
    /** Saldo atual. Pode ficar negativo (o sistema avisa, mas não impede a venda). */
    stock: integer('stock').notNull().default(0),
    /** 0 = sem alerta de estoque mínimo. */
    minStock: integer('min_stock').notNull().default(0),
    unit: text('unit').notNull().default('un'),
    notes: text('notes'),
    isActive: bool('is_active', true),
    showOnSite: bool('show_on_site', true),
    /** Pode ser comprado na loja virtual (exige preço e estoque; sem eles o site só oferece "consultar"). */
    sellOnline: bool('sell_online', true),
    /** Texto público da loja (a empresa escreve; nada é inventado). `notes` continua sendo interno. */
    storeDescription: text('store_description'),
    /**
     * Preço FICTÍCIO de demonstração: só existe enquanto houver dados de demonstração e nunca substitui um preço real
     * (`sale_price_cents`). É removido junto com os demais dados de demonstração.
     */
    demoPriceCents: integer('demo_price_cents'),
    /** Chave do ícone técnico exibido no site quando não há foto. */
    iconKey: text('icon_key'),
    imageFileId: integer('image_file_id').references(() => files.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    searchText: text('search_text').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('products_prices_nonneg', sql`${t.salePriceCents} >= 0 AND ${t.costCents} >= 0`),
    index('idx_products_category').on(t.category),
  ],
);

/** Livro-razão de estoque: o saldo em `products.stock` é sempre a soma dos movimentos. */
export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: pk(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: text('reason', { enum: STOCK_REASON_KEYS }).notNull(),
    /** Origem do movimento: 'service_order' | 'sale' | null. */
    refType: text('ref_type'),
    refId: integer('ref_id'),
    note: text('note'),
    isDemo: bool('is_demo', false),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_stock_product').on(t.productId, t.createdAt),
    index('idx_stock_ref').on(t.refType, t.refId),
  ],
);

// =====================================================================
// Ordens de serviço
// =====================================================================

export const serviceOrders = sqliteTable(
  'service_orders',
  {
    id: pk(),
    /** Número sequencial exibido como OS-000123. */
    number: integer('number').notNull().unique(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    status: text('status', { enum: ORDER_STATUS_KEYS }).notNull().default('AGUARDANDO_AVALIACAO'),
    equipment: text('equipment').notNull(),
    brand: text('brand'),
    model: text('model'),
    problemDescription: text('problem_description'),
    diagnosis: text('diagnosis'),
    /** Descrição do serviço realizado (texto livre exibido no documento). */
    serviceDescription: text('service_description'),
    entryDate: text('entry_date').notNull(),
    expectedDeliveryDate: text('expected_delivery_date'),
    deliveredDate: text('delivered_date'),
    /** Data em que o serviço foi concluído (status Pronto/Entregue). */
    completedDate: text('completed_date'),
    /** Data prevista do próximo serviço (manutenção preventiva, retorno…). */
    nextServiceDate: text('next_service_date'),
    technicianId: integer('technician_id').references(() => users.id, { onDelete: 'set null' }),
    /** Forma de pagamento combinada; os pagamentos efetivos ficam em `payments`. */
    paymentMethod: text('payment_method', { enum: PAYMENT_METHOD_KEYS }),
    discountCents: money('discount_cents'),
    partsTotalCents: money('parts_total_cents'),
    laborTotalCents: money('labor_total_cents'),
    totalCents: money('total_cents'),
    /** Observações exibidas no documento. Comentários internos ficam no histórico (eventos). */
    notes: text('notes'),
    /** Versão dos termos de garantia congelada na entrega. */
    guaranteeTermsId: integer('guarantee_terms_id').references(() => guaranteeTerms.id, { onDelete: 'set null' }),
    canceledAt: ts('canceled_at'),
    cancelReason: text('cancel_reason'),
    searchText: text('search_text').notNull().default(''),
    isDemo: bool('is_demo', false),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('idx_orders_customer').on(t.customerId),
    index('idx_orders_status').on(t.status),
    index('idx_orders_entry_date').on(t.entryDate),
    index('idx_orders_completed').on(t.completedDate),
    index('idx_orders_delivered').on(t.deliveredDate),
    index('idx_orders_expected').on(t.expectedDeliveryDate),
    index('idx_orders_technician').on(t.technicianId),
    check('orders_money_nonneg', sql`${t.discountCents} >= 0 AND ${t.totalCents} >= 0`),
  ],
);

export const serviceOrderItems = sqliteTable(
  'service_order_items',
  {
    id: pk(),
    orderId: integer('order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    /** SERVICE = mão de obra/serviço; PART = peça/produto. */
    kind: text('kind', { enum: ITEM_KIND_KEYS }).notNull(),
    serviceId: integer('service_id').references(() => services.id, { onDelete: 'set null' }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPriceCents: money('unit_price_cents'),
    /** Custo unitário no momento da inclusão (para análises de margem). */
    unitCostCents: money('unit_cost_cents'),
    totalCents: money('total_cents'),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    index('idx_order_items_order').on(t.orderId),
    index('idx_order_items_product').on(t.productId),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
);

/** Linha do tempo da OS (criação, mudanças de status, comentários internos, pagamentos, documentos). */
export const serviceOrderEvents = sqliteTable(
  'service_order_events',
  {
    id: pk(),
    orderId: integer('order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['CREATED', 'STATUS', 'NOTE', 'PAYMENT', 'DOCUMENT', 'EDIT'] }).notNull(),
    fromStatus: text('from_status', { enum: ORDER_STATUS_KEYS }),
    toStatus: text('to_status', { enum: ORDER_STATUS_KEYS }),
    message: text('message'),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('idx_order_events_order').on(t.orderId, t.createdAt)],
);

// =====================================================================
// Vendas
// =====================================================================

export const sales = sqliteTable(
  'sales',
  {
    id: pk(),
    number: integer('number').notNull().unique(),
    /** Nulo = consumidor final. */
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    saleDate: text('sale_date').notNull(),
    discountCents: money('discount_cents'),
    totalCents: money('total_cents'),
    status: text('status', { enum: ['ACTIVE', 'CANCELED'] })
      .notNull()
      .default('ACTIVE'),
    /** BALCAO = registrada pela equipe; LOJA = pedido feito na loja virtual (ver `store_orders`). */
    channel: text('channel', { enum: ['BALCAO', 'LOJA'] })
      .notNull()
      .default('BALCAO'),
    notes: text('notes'),
    canceledAt: ts('canceled_at'),
    cancelReason: text('cancel_reason'),
    searchText: text('search_text').notNull().default(''),
    isDemo: bool('is_demo', false),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('idx_sales_date').on(t.saleDate), index('idx_sales_customer').on(t.customerId), index('idx_sales_channel').on(t.channel)],
);

export const saleItems = sqliteTable(
  'sale_items',
  {
    id: pk(),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPriceCents: money('unit_price_cents'),
    unitCostCents: money('unit_cost_cents'),
    totalCents: money('total_cents'),
    /** Linha de taxa (ex.: entrega): soma no total, mas não é um produto vendido (fora dos rankings). */
    isFee: bool('is_fee', false),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    index('idx_sale_items_sale').on(t.saleId),
    index('idx_sale_items_product').on(t.productId),
    check('sale_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
);

// =====================================================================
// Loja virtual
// =====================================================================

/** Linha única (id = 1). Sem a linha, o sistema usa os padrões de `STORE_DEFAULTS`. */
export const storeSettings = sqliteTable('store_settings', {
  id: integer('id').primaryKey(),
  /** Loja aberta ao público (fechada: o site volta a apenas "consultar pelo WhatsApp"). */
  enabled: bool('enabled', true),
  /** Chave PIX da empresa, já normalizada (ver `lib/pix.ts`). Sem chave, a loja não oferece pagamento por PIX. */
  pixKey: text('pix_key'),
  pixKeyType: text('pix_key_type', { enum: PIX_KEY_TYPES }),
  deliveryEnabled: bool('delivery_enabled', false),
  deliveryFeeCents: money('delivery_fee_cents'),
  /** Pedidos a partir deste valor têm entrega grátis (nulo = nunca). */
  freeDeliveryMinCents: integer('free_delivery_min_cents'),
  deliveryNote: text('delivery_note'),
  pickupNote: text('pickup_note'),
  minOrderCents: money('min_order_cents'),
  /** Horas que um pedido com PIX não pago segura o estoque antes de ser cancelado sozinho (0 = nunca). */
  holdHours: integer('hold_hours').notNull().default(24),
  /** Condições da loja (trocas, devoluções, prazos…) escritas pela empresa. */
  policyText: text('policy_text'),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});

/** Pedido feito na loja virtual. Cada pedido tem uma venda (`sales`, canal LOJA) que cuida de estoque e financeiro. */
export const storeOrders = sqliteTable(
  'store_orders',
  {
    id: pk(),
    /** Número sequencial exibido como LJ-000123. */
    number: integer('number').notNull().unique(),
    /** Token aleatório (256 bits) do link público de acompanhamento. */
    token: text('token').notNull(),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'restrict' }),
    status: text('status', { enum: STORE_ORDER_STATUS_KEYS }).notNull().default('RECEIVED'),
    fulfillment: text('fulfillment', { enum: FULFILLMENT_KEYS }).notNull(),
    paymentMethod: text('payment_method', { enum: STORE_PAYMENT_KEYS }).notNull(),
    buyerName: text('buyer_name').notNull(),
    /** Somente dígitos (com DDD). */
    buyerPhone: text('buyer_phone').notNull(),
    buyerEmail: text('buyer_email'),
    deliveryAddress: text('delivery_address', { mode: 'json' }).$type<DeliveryAddress>(),
    /** Observação escrita pelo comprador. */
    notes: text('notes'),
    subtotalCents: money('subtotal_cents'),
    deliveryFeeCents: money('delivery_fee_cents'),
    totalCents: money('total_cents'),
    /** "Copia e cola" do PIX gerado no pedido (guardado: mudar a chave depois não altera pedidos antigos). */
    pixPayload: text('pix_payload'),
    searchText: text('search_text').notNull().default(''),
    isDemo: bool('is_demo', false),
    createdIp: text('created_ip'),
    confirmedAt: ts('confirmed_at'),
    readyAt: ts('ready_at'),
    completedAt: ts('completed_at'),
    canceledAt: ts('canceled_at'),
    cancelReason: text('cancel_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('uq_store_orders_token').on(t.token),
    uniqueIndex('uq_store_orders_sale').on(t.saleId),
    index('idx_store_orders_status').on(t.status, t.createdAt),
    index('idx_store_orders_created').on(t.createdAt),
    index('idx_store_orders_ip').on(t.createdIp, t.createdAt),
    index('idx_store_orders_phone').on(t.buyerPhone),
  ],
);

/** Linha do tempo do pedido. Eventos públicos aparecem para o cliente no link de acompanhamento. */
export const storeOrderEvents = sqliteTable(
  'store_order_events',
  {
    id: pk(),
    orderId: integer('order_id')
      .notNull()
      .references(() => storeOrders.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['CREATED', 'STATUS', 'PAYMENT', 'NOTE'] }).notNull(),
    toStatus: text('to_status', { enum: STORE_ORDER_STATUS_KEYS }),
    message: text('message'),
    isPublic: bool('is_public', true),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('idx_store_events_order').on(t.orderId, t.createdAt)],
);

// =====================================================================
// Financeiro: entradas (payments) e custos (expenses)
// =====================================================================

/** Cada pagamento recebido é uma "entrada". Pode estar ligado a uma OS, a uma venda ou ser avulso. */
export const payments = sqliteTable(
  'payments',
  {
    id: pk(),
    orderId: integer('order_id').references(() => serviceOrders.id, { onDelete: 'restrict' }),
    saleId: integer('sale_id').references(() => sales.id, { onDelete: 'restrict' }),
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    description: text('description').notNull(),
    amountCents: integer('amount_cents').notNull(),
    method: text('method', { enum: PAYMENT_METHOD_KEYS }).notNull(),
    paidDate: text('paid_date').notNull(),
    /** Pagamentos estornados permanecem no histórico, mas não entram nos totais. */
    status: text('status', { enum: ['PAID', 'VOIDED'] })
      .notNull()
      .default('PAID'),
    voidedAt: ts('voided_at'),
    voidReason: text('void_reason'),
    voidedBy: integer('voided_by').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    isDemo: bool('is_demo', false),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('idx_payments_date').on(t.paidDate),
    index('idx_payments_order').on(t.orderId),
    index('idx_payments_sale').on(t.saleId),
    index('idx_payments_customer').on(t.customerId),
    index('idx_payments_method').on(t.method),
    check('payments_amount_positive', sql`${t.amountCents} > 0`),
  ],
);

export const expenseCategories = sqliteTable('expense_categories', {
  id: pk(),
  name: text('name').notNull().unique(),
  /** Categorias marcadas como "mercadorias" alimentam o card "Custo de mercadorias". */
  isGoods: bool('is_goods', false),
  isActive: bool('is_active', true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

export const expenses = sqliteTable(
  'expenses',
  {
    id: pk(),
    date: text('date').notNull(),
    description: text('description').notNull(),
    supplier: text('supplier'),
    categoryId: integer('category_id')
      .notNull()
      .references(() => expenseCategories.id, { onDelete: 'restrict' }),
    amountCents: integer('amount_cents').notNull(),
    paymentMethod: text('payment_method', { enum: PAYMENT_METHOD_KEYS }),
    notes: text('notes'),
    isDemo: bool('is_demo', false),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('idx_expenses_date').on(t.date),
    index('idx_expenses_category').on(t.categoryId),
    check('expenses_amount_positive', sql`${t.amountCents} > 0`),
  ],
);

// =====================================================================
// Relatórios, notificações, auditoria e links de documentos
// =====================================================================

/** Histórico de relatórios gerados/impressos/exportados (com o resumo no momento da geração). */
export const reports = sqliteTable(
  'reports',
  {
    id: pk(),
    type: text('type', { enum: ['ENTRADAS', 'CUSTOS', 'SERVICOS', 'CLIENTES', 'FINANCEIRO'] }).notNull(),
    title: text('title').notNull(),
    periodStart: text('period_start').notNull(),
    periodEnd: text('period_end').notNull(),
    format: text('format', { enum: ['VIEW', 'PRINT', 'PDF', 'CSV'] }).notNull(),
    params: text('params', { mode: 'json' }).$type<Record<string, unknown>>(),
    summary: text('summary', { mode: 'json' }).$type<Record<string, unknown>>(),
    generatedBy: integer('generated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('idx_reports_created').on(t.createdAt)],
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: pk(),
    type: text('type', {
      enum: ['ORDER_CREATED', 'ORDER_AWAITING_APPROVAL', 'ORDER_READY', 'PAYMENT_RECEIVED', 'SALE_CREATED', 'STORE_ORDER', 'INFO'],
    }).notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    /** Somente usuários com esta permissão veem a notificação (nulo = todos). */
    permission: text('permission'),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    isDemo: bool('is_demo', false),
    createdAt: createdAt(),
  },
  (t) => [index('idx_notifications_created').on(t.createdAt)],
);

export const notificationReads = sqliteTable(
  'notification_reads',
  {
    notificationId: integer('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readAt: ts('read_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.notificationId, t.userId] })],
);

/** Trilha de auditoria das operações críticas. */
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: pk(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Nome do usuário no momento da ação (preserva o histórico se o usuário for alterado). */
    userName: text('user_name'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: integer('entity_id'),
    summary: text('summary'),
    data: text('data', { mode: 'json' }).$type<Record<string, unknown>>(),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('idx_audit_created').on(t.createdAt), index('idx_audit_entity').on(t.entityType, t.entityId)],
);

/** Links públicos e não adivinháveis para compartilhar documentos (PDF) com o cliente. */
export const documentLinks = sqliteTable(
  'document_links',
  {
    id: pk(),
    token: text('token').notNull(),
    type: text('type', { enum: ['ORDER', 'SALE', 'RECEIPT'] }).notNull(),
    refId: integer('ref_id').notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    expiresAt: ts('expires_at'),
    revokedAt: ts('revoked_at'),
    lastAccessAt: ts('last_access_at'),
    accessCount: integer('access_count').notNull().default(0),
  },
  (t) => [uniqueIndex('uq_document_links_token').on(t.token), index('idx_document_links_ref').on(t.type, t.refId)],
);

// =====================================================================
// Relações (consultas relacionais do Drizzle)
// =====================================================================

export const rolesRelations = relations(roles, ({ many }) => ({ users: many(users) }));

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(serviceOrders),
  sales: many(sales),
  payments: many(payments),
}));

export const productsRelations = relations(products, ({ many, one }) => ({
  movements: many(stockMovements),
  image: one(files, { fields: [products.imageFileId], references: [files.id] }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, { fields: [stockMovements.productId], references: [products.id] }),
  user: one(users, { fields: [stockMovements.createdBy], references: [users.id] }),
}));

export const serviceOrdersRelations = relations(serviceOrders, ({ one, many }) => ({
  customer: one(customers, { fields: [serviceOrders.customerId], references: [customers.id] }),
  technician: one(users, { fields: [serviceOrders.technicianId], references: [users.id], relationName: 'technician' }),
  creator: one(users, { fields: [serviceOrders.createdBy], references: [users.id], relationName: 'creator' }),
  terms: one(guaranteeTerms, { fields: [serviceOrders.guaranteeTermsId], references: [guaranteeTerms.id] }),
  items: many(serviceOrderItems),
  events: many(serviceOrderEvents),
  payments: many(payments),
}));

export const serviceOrderItemsRelations = relations(serviceOrderItems, ({ one }) => ({
  order: one(serviceOrders, { fields: [serviceOrderItems.orderId], references: [serviceOrders.id] }),
  product: one(products, { fields: [serviceOrderItems.productId], references: [products.id] }),
  service: one(services, { fields: [serviceOrderItems.serviceId], references: [services.id] }),
}));

export const serviceOrderEventsRelations = relations(serviceOrderEvents, ({ one }) => ({
  order: one(serviceOrders, { fields: [serviceOrderEvents.orderId], references: [serviceOrders.id] }),
  user: one(users, { fields: [serviceOrderEvents.userId], references: [users.id] }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  creator: one(users, { fields: [sales.createdBy], references: [users.id] }),
  items: many(saleItems),
  payments: many(payments),
}));

export const storeOrdersRelations = relations(storeOrders, ({ one, many }) => ({
  sale: one(sales, { fields: [storeOrders.saleId], references: [sales.id] }),
  events: many(storeOrderEvents),
}));

export const storeOrderEventsRelations = relations(storeOrderEvents, ({ one }) => ({
  order: one(storeOrders, { fields: [storeOrderEvents.orderId], references: [storeOrders.id] }),
  user: one(users, { fields: [storeOrderEvents.userId], references: [users.id] }),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, { fields: [saleItems.productId], references: [products.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(serviceOrders, { fields: [payments.orderId], references: [serviceOrders.id] }),
  sale: one(sales, { fields: [payments.saleId], references: [sales.id] }),
  customer: one(customers, { fields: [payments.customerId], references: [customers.id] }),
  creator: one(users, { fields: [payments.createdBy], references: [users.id], relationName: 'paymentCreator' }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(expenseCategories, { fields: [expenses.categoryId], references: [expenseCategories.id] }),
}));

export const siteImagesRelations = relations(siteImages, ({ one }) => ({
  file: one(files, { fields: [siteImages.fileId], references: [files.id] }),
}));

// ---------- tipos derivados ----------
export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type ServiceOrderItem = typeof serviceOrderItems.$inferSelect;
export type ServiceOrderEvent = typeof serviceOrderEvents.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type CompanySettings = typeof companySettings.$inferSelect;
export type GuaranteeTerms = typeof guaranteeTerms.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type StoreSettings = typeof storeSettings.$inferSelect;
export type StoreOrder = typeof storeOrders.$inferSelect;
export type StoreOrderEvent = typeof storeOrderEvents.$inferSelect;
