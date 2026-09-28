/**
 * Serviços e produtos OFICIAIS informados pela empresa.
 * Nenhum preço, estoque ou item além dos fornecidos é inventado: valores ficam vazios (a definir)
 * e são cadastrados depois em Serviços / Produtos.
 */

/** Grupos exibidos no site (a ordem aqui é a ordem de exibição). */
export const SERVICE_GROUPS = ['Principais', 'Motores', 'Bombas', 'Outros equipamentos'] as const;
export type ServiceGroup = (typeof SERVICE_GROUPS)[number];

export const OFFICIAL_SERVICES: { name: string; category: ServiceGroup }[] = [
  { name: 'Rebobinamento de motores elétricos', category: 'Principais' },
  { name: 'Manutenção em geral', category: 'Principais' },
  { name: 'Rebobinamento de bombas', category: 'Principais' },
  { name: 'Manutenção de motores de máquinas de costura', category: 'Motores' },
  { name: 'Manutenção de motor compressor', category: 'Motores' },
  { name: 'Manutenção de motores de ar-condicionado', category: 'Motores' },
  { name: 'Manutenção de motores de elevador de carro', category: 'Motores' },
  { name: 'Manutenção de bombas de piscina', category: 'Bombas' },
  { name: 'Manutenção de bombas submersas', category: 'Bombas' },
  { name: 'Manutenção de bomba autoaspirante', category: 'Bombas' },
  { name: 'Manutenção de bombas injetoras', category: 'Bombas' },
  { name: 'Manutenção de bombas centrífugas', category: 'Bombas' },
  { name: 'Manutenção de bombas periféricas', category: 'Bombas' },
  { name: 'Manutenção de liquidificador industrial', category: 'Outros equipamentos' },
  { name: 'Manutenção de forrageira', category: 'Outros equipamentos' },
  { name: 'Manutenção de exaustores', category: 'Outros equipamentos' },
  { name: 'Manutenção de esmeril', category: 'Outros equipamentos' },
  { name: 'Manutenção de ventiladores', category: 'Outros equipamentos' },
  { name: 'Outros equipamentos', category: 'Outros equipamentos' },
];

/** `iconKey` aponta para o ícone técnico do site (ver components/site/ProductIcon). */
export const OFFICIAL_PRODUCTS: { name: string; iconKey: string }[] = [
  { name: 'Rolamentos', iconKey: 'bearing' },
  { name: 'Selo mecânico', iconKey: 'mechanical-seal' },
  { name: 'Capacitor permanente', iconKey: 'capacitor-run' },
  { name: 'Capacitor eletrolítico', iconKey: 'capacitor-electrolytic' },
  { name: 'Centrífugo', iconKey: 'centrifugal-switch' },
  { name: 'Platinado', iconKey: 'contacts' },
  { name: 'Ventoinha', iconKey: 'fan' },
  { name: 'Tampa intermediária', iconKey: 'end-cap' },
  { name: 'Tampa dianteira', iconKey: 'end-cap' },
  { name: 'Tampa traseira', iconKey: 'end-cap' },
  { name: 'Manômetro', iconKey: 'gauge' },
  { name: 'Polia', iconKey: 'pulley' },
  { name: 'Rotor', iconKey: 'rotor' },
];
