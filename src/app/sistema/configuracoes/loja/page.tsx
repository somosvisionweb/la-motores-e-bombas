import Link from 'next/link';
import { CircleCheck, CircleDashed, ExternalLink } from 'lucide-react';
import { StoreSettingsForm } from '@/components/system/settings/StoreSettingsForm';
import { SettingsTabs } from '@/components/system/settings/SettingsTabs';
import { Alert } from '@/components/ui/Alert';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { getStoreReadiness } from '@/server/services/store';
import { getStoreSettings } from '@/server/services/store-settings';

export const metadata = { title: 'Loja virtual' };

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      {done ? <CircleCheck aria-hidden="true" size={20} style={{ color: 'var(--green-600)', flex: 'none', marginTop: 2 }} /> : <CircleDashed aria-hidden="true" size={20} style={{ color: 'var(--gray-400)', flex: 'none', marginTop: 2 }} />}
      <span>{children}</span>
    </li>
  );
}

export default async function StoreSettingsPage() {
  await requirePagePermission('settings.manage');
  const [config, readiness] = await Promise.all([getStoreSettings(), getStoreReadiness()]);

  return (
    <>
      <PageHeader
        title="Loja virtual"
        subtitle="Vitrine com carrinho no site: o cliente escolhe os produtos, finaliza o pedido e acompanha pelo celular."
        actions={
          <Link href="/loja" target="_blank" className="btn">
            <ExternalLink aria-hidden="true" /> Ver a loja
          </Link>
        }
      />
      <SettingsTabs active="loja" />
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        {readiness.demoPrices ? (
          <Alert variant="demo" title="A loja está usando preços de DEMONSTRAÇÃO">
            Os preços e o estoque que aparecem no site são fictícios e servem só para conhecer a loja (o site exibe um aviso de demonstração). Cadastre os preços reais em{' '}
            <Link href="/sistema/produtos">Produtos</Link> e remova os dados de demonstração em <Link href="/sistema/configuracoes/dados">Dados e segurança</Link>.
          </Alert>
        ) : null}

        <Card>
          <CardHeader title="Para vender de verdade" subtitle="O que falta para a loja funcionar com os dados reais da empresa." />
          <CardBody>
            <ul style={{ display: 'grid', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
              <Step done={readiness.sellable > 0}>
                <strong>Preço e estoque nos produtos</strong> — {readiness.sellable} de {readiness.visible} produtos prontos para vender online ({readiness.withPrice} com preço cadastrado). Ajuste em{' '}
                <Link href="/sistema/produtos">Produtos</Link>; produtos sem preço aparecem como “valor sob consulta”, nunca com preço inventado.
              </Step>
              <Step done={Boolean(config.pixKey)}>
                <strong>Chave PIX</strong> — {config.pixKey ? 'configurada.' : 'sem chave, a loja só oferece pagamento na retirada.'}
              </Step>
              <Step done={config.deliveryEnabled}>
                <strong>Entrega</strong> — {config.deliveryEnabled ? 'ativada.' : 'desligada (só retirada na loja). Ative se a empresa entregar peças.'}
              </Step>
              <Step done={Boolean(config.policyText)}>
                <strong>Condições da loja</strong> — {config.policyText ? 'informadas no checkout.' : 'opcional: trocas, devoluções e prazos.'}
              </Step>
              <Step done={!readiness.demoPrices}>
                <strong>Dados de demonstração removidos</strong> — {readiness.demoPrices ? 'ainda há preços fictícios na loja.' : 'sem preços fictícios.'}
              </Step>
            </ul>
          </CardBody>
        </Card>

        <StoreSettingsForm config={config} />
      </div>
    </>
  );
}
