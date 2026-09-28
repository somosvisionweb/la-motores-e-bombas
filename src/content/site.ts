/**
 * Textos do site fornecidos pela LA Motores e Bombas (mantidos como recebidos).
 * Dados da empresa (endereço, telefone, horários…) NÃO ficam aqui: vêm de Configurações → Empresa.
 */
export const SITE_COPY = {
  heroHeadline: 'Seu equipamento parado não precisa virar prejuízo.',
  /** Trecho da headline que ganha destaque (verde). */
  heroAccent: 'não precisa virar prejuízo.',
  heroSubheadline:
    'Manutenção, conserto e rebobinamento de motores elétricos, bombas e diversos equipamentos com atendimento profissional e soluções seguras.',

  /** Texto do cliente para "Sobre nós" e "Nosso diferencial" (dividido em parágrafos, sem alterar as palavras). */
  about: {
    intro: 'Na LA Motores e Bombas, cada equipamento é tratado com responsabilidade, precisão e compromisso com o cliente.',
    specialty:
      'Somos especializados em manutenção, conserto e rebobinamento de motores elétricos e bombas d’água, além da manutenção de diversos equipamentos, sempre buscando identificar a causa do problema e oferecer uma solução segura, eficiente e com ótimo custo-benefício.',
  },
  differential: {
    quote: 'Nosso diferencial está na união de experiência prática, conhecimento técnico, atendimento personalizado e transparência.',
    evaluation:
      'Antes de qualquer serviço, avaliamos o equipamento para orientar o cliente sobre o reparo mais adequado, evitando gastos desnecessários e aumentando a vida útil do equipamento.',
    range:
      'Atendemos desde motores elétricos e bombas d’água até máquinas de costura, liquidificadores industriais, ventiladores de parede, exaustores, forrageiras e outros equipamentos.',
    closing:
      'LA Motores e Bombas — seu equipamento parado não precisa virar prejuízo. Nós trabalhamos para colocar seu equipamento novamente em funcionamento com segurança e qualidade.',
  },

  /** Os quatro pilares citados no texto do diferencial. */
  pillars: [
    { title: 'Experiência prática', text: 'Conhecimento aplicado no dia a dia com motores e bombas.' },
    { title: 'Conhecimento técnico', text: 'Análise para identificar a causa do problema.' },
    { title: 'Atendimento personalizado', text: 'Atenção individual a cada equipamento e cliente.' },
    { title: 'Transparência', text: 'Avaliação antes do serviço e orientação sobre o reparo.' },
  ],

  /** Pontos da seção "Sobre nós" (derivados do texto acima e dos dados oficiais). */
  aboutPoints: [
    { title: 'Avaliação antes do serviço', text: 'Analisamos o equipamento para orientar sobre o reparo mais adequado.' },
    { title: 'Solução segura e eficiente', text: 'Buscamos a causa do problema, com ótimo custo-benefício.' },
    { title: 'Presencial ou a domicílio', text: 'Atendimento em nosso endereço e serviços a domicílio.' },
  ],

  homeService: {
    title: 'Realizamos serviços a domicílio.',
    text: 'Solicite pelo WhatsApp e combine o atendimento com a nossa equipe.',
  },
} as const;

/** Ícone e texto de apoio de cada grupo de serviços (grupos novos usam o padrão). */
export const SERVICE_GROUP_INFO: Record<string, { title: string; text: string }> = {
  Principais: { title: 'Serviços principais', text: 'O que fazemos de mais procurado.' },
  Motores: { title: 'Motores', text: 'Manutenção de motores de diferentes aplicações.' },
  Bombas: { title: 'Bombas', text: 'Manutenção de bombas de vários tipos.' },
  'Outros equipamentos': { title: 'Outros equipamentos', text: 'Equipamentos que também atendemos.' },
};
