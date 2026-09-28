/** Ícones técnicos disponíveis para produtos sem foto (ver components/ui/ProductIcon). */
export const PRODUCT_ICONS = [
  { key: 'bearing', label: 'Rolamento' },
  { key: 'mechanical-seal', label: 'Selo mecânico' },
  { key: 'capacitor-run', label: 'Capacitor permanente' },
  { key: 'capacitor-electrolytic', label: 'Capacitor eletrolítico' },
  { key: 'centrifugal-switch', label: 'Centrífugo' },
  { key: 'contacts', label: 'Platinado / contatos' },
  { key: 'fan', label: 'Ventoinha' },
  { key: 'end-cap', label: 'Tampa' },
  { key: 'gauge', label: 'Manômetro' },
  { key: 'pulley', label: 'Polia' },
  { key: 'rotor', label: 'Rotor' },
  { key: 'component', label: 'Componente genérico' },
] as const;

export type ProductIconKey = (typeof PRODUCT_ICONS)[number]['key'];

export function isProductIconKey(value: unknown): value is ProductIconKey {
  return PRODUCT_ICONS.some((i) => i.key === value);
}
