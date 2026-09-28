/**
 * DADOS OFICIAIS INICIAIS da LA Motores e Bombas.
 *
 * Usados SOMENTE pelo seed para preencher a tabela `company_settings` na primeira instalação.
 * Em execução, site, documentos e PDFs leem tudo de Configurações → Empresa (banco de dados),
 * portanto a empresa altera estes dados sem mexer no código.
 */
import type { BusinessHours, WhatsAppTemplates } from './company';
import type { PaymentMethod } from './payment-methods';

const weekday = { closed: false, open: '08:00', close: '17:00' } as const;

export const OFFICIAL_HOURS: BusinessHours = {
  mon: { ...weekday },
  tue: { ...weekday },
  wed: { ...weekday },
  thu: { ...weekday },
  fri: { ...weekday },
  sat: { closed: false, open: '08:00', close: '12:00' },
  sun: { closed: true, open: null, close: null },
};

export const OFFICIAL_WHATSAPP_TEMPLATES: WhatsAppTemplates = {
  general: 'Olá! Gostaria de falar com a {{empresa}}.',
  attendance: 'Olá! Gostaria de solicitar um atendimento da {{empresa}}.',
  quote: 'Olá! Gostaria de solicitar um orçamento na {{empresa}}.',
  homeVisit: 'Olá! Gostaria de solicitar um atendimento a domicílio da {{empresa}}.',
  orderShare:
    'Olá, {{nome}}. Segue o comprovante/ordem de serviço referente ao atendimento realizado pela {{empresa}}.',
  storeOrder: 'Olá, {{nome}}! Aqui é da {{empresa}}. Sobre o seu pedido {{codigo}} na nossa loja, você acompanha por este link: {{link}}',
};

/** Mensagem sobre pedido da loja (perfis antigos, salvos antes da loja virtual, usam o modelo padrão). */
export function storeOrderTemplate(templates: WhatsAppTemplates): string {
  return templates.storeOrder?.trim() || OFFICIAL_WHATSAPP_TEMPLATES.storeOrder!;
}

export const OFFICIAL_COMPANY = {
  name: 'LA Motores e Bombas',
  cnpj: '31.127.662/0001-50',
  email: 'lamotoreseletricos@gmail.com',
  whatsapp: '5581996405805',
  phone: '(81) 99640-5805',
  address: 'Rua Serafim Luiz Pinto, 15',
  city: 'Jaboatão dos Guararapes',
  state: 'PE',
  instagram: '@l.a_motores_e_bombas',
  hours: OFFICIAL_HOURS,
  paymentMethods: ['DINHEIRO', 'PIX', 'CARTAO', 'BOLETO'] as PaymentMethod[],
  seoTitle: 'LA Motores e Bombas | Assistência Técnica em Jaboatão dos Guararapes',
  seoDescription:
    "Assistência técnica em motores elétricos e bombas d'água em Jaboatão dos Guararapes: manutenção, conserto, rebobinamento e atendimento a domicílio.",
  timezone: 'America/Recife',
  whatsappTemplates: OFFICIAL_WHATSAPP_TEMPLATES,
} as const;

/** Usuários iniciais (as senhas temporárias são geradas aleatoriamente pelo seed). */
export const OFFICIAL_USERS = [
  { name: 'Ewerton Nunes', username: 'ewerton', roleKey: 'admin' },
  { name: 'Mario Vinicius', username: 'mario', roleKey: 'seller' },
] as const;

/**
 * Categorias de custo iniciais (genéricas e editáveis em Financeiro → Custos).
 * "Mercadorias" alimenta o card "Custo de mercadorias" do dashboard.
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Mercadorias', isGoods: true },
  { name: 'Ferramentas e equipamentos', isGoods: false },
  { name: 'Despesas fixas', isGoods: false },
  { name: 'Impostos e taxas', isGoods: false },
  { name: 'Transporte', isGoods: false },
  { name: 'Outros', isGoods: false },
] as const;
