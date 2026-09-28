import { FlaskConical } from 'lucide-react';

/** Aviso permanente enquanto a loja usa preços/estoque de demonstração (nunca apresentar dados fictícios como reais). */
export function StoreDemoBanner({ compact }: { compact?: boolean }) {
  return (
    <div className={`store-demo${compact ? ' store-demo--compact' : ''}`} role="note">
      <FlaskConical aria-hidden="true" />
      <p>
        <strong>Loja em demonstração.</strong> Os preços, o estoque e os pedidos daqui são fictícios (dados de exemplo). Nenhum produto será entregue e nenhum pagamento é real.
      </p>
    </div>
  );
}
