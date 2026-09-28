'use client';

import { Database, Trash2 } from 'lucide-react';
import { clearDemoDataAction, loadDemoDataAction } from '@/actions/settings';
import { ActionForm } from '@/components/form/ActionForm';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function DemoDataPanel({ hasDemo }: { hasDemo: boolean }) {
  return (
    <div className="cluster">
      {hasDemo ? (
        <ConfirmActionForm
          action={clearDemoDataAction}
          title="Remover todos os dados de demonstração?"
          message="Serão apagados os clientes, ordens, vendas, pedidos da loja, pagamentos e custos fictícios (marcados com “Demonstração”) e os preços de demonstração da loja virtual. Dados reais nunca são removidos. Esta ação não pode ser desfeita."
          confirmLabel="Remover dados de demonstração"
          triggerLabel="Remover dados de demonstração"
          triggerIcon={<Trash2 aria-hidden="true" />}
          triggerVariant="danger-soft"
          triggerSize="md"
        />
      ) : (
        <ActionForm action={loadDemoDataAction} successToast>
          <SubmitButton variant="secondary" pendingLabel="Criando dados…">
            <Database aria-hidden="true" /> Carregar dados de demonstração
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
