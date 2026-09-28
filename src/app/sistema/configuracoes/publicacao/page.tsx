import Link from 'next/link';
import { CircleCheck, CircleDashed, Info, Rocket } from 'lucide-react';
import { SettingsTabs } from '@/components/system/settings/SettingsTabs';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { CHECKLIST_GROUP_LABEL, getPublicationChecklist, type ChecklistGroup, type ChecklistItem } from '@/server/services/publication';

export const metadata = { title: 'Publicação do site' };

const GROUPS: ChecklistGroup[] = ['empresa', 'loja', 'publicacao'];

function StepIcon({ item }: { item: ChecklistItem }) {
  if (item.status === 'done') return <CircleCheck aria-hidden="true" className="publish-step__icon publish-step__icon--done" />;
  if (item.status === 'info') return <Info aria-hidden="true" className="publish-step__icon publish-step__icon--info" />;
  return <CircleDashed aria-hidden="true" className="publish-step__icon" />;
}

export default async function PublicationPage() {
  await requirePagePermission('settings.manage');
  const checklist = await getPublicationChecklist();
  const percent = checklist.requiredTotal === 0 ? 100 : Math.round((checklist.requiredDone / checklist.requiredTotal) * 100);
  const missing = checklist.requiredTotal - checklist.requiredDone;

  return (
    <>
      <PageHeader title="Publicação do site" subtitle="Confira o que falta para o site e a loja ficarem prontos e funcionando. O status é calculado com os dados reais do sistema — nada é marcado à mão." />
      <SettingsTabs active="publicacao" />
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <Card accent>
          <CardBody>
            <div className="publish-summary">
              <span className={`publish-summary__icon${checklist.ready ? ' publish-summary__icon--ready' : ''}`}>
                <Rocket aria-hidden="true" />
              </span>
              <div className="publish-summary__body">
                <h2>{checklist.ready ? 'Tudo certo para publicar' : `Faltam ${missing} ${missing === 1 ? 'passo obrigatório' : 'passos obrigatórios'}`}</h2>
                <p className="text-muted">
                  {checklist.requiredDone} de {checklist.requiredTotal} passos obrigatórios concluídos. Os itens “recomendados” melhoram o site, mas não impedem a publicação.
                </p>
                <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Progresso da publicação">
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {GROUPS.map((group) => {
          const items = checklist.items.filter((item) => item.group === group);
          return (
            <Card key={group}>
              <CardHeader title={CHECKLIST_GROUP_LABEL[group]} />
              <ul className="publish-steps">
                {items.map((item) => (
                  <li key={item.key} className={`publish-step publish-step--${item.status}`}>
                    <StepIcon item={item} />
                    <div className="publish-step__body">
                      <p className="publish-step__title">
                        {item.title}{' '}
                        {item.required ? (
                          <Badge tone={item.status === 'done' ? 'green' : 'red'}>Obrigatório</Badge>
                        ) : item.status === 'info' ? (
                          <Badge tone="slate">Informativo</Badge>
                        ) : (
                          <Badge tone={item.status === 'done' ? 'green' : 'amber'}>Recomendado</Badge>
                        )}
                      </p>
                      <p className="publish-step__detail">{item.detail}</p>
                    </div>
                    {item.href && item.status !== 'done' ? (
                      <Link href={item.href} className="btn btn--sm">
                        {item.actionLabel ?? 'Abrir'}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}

        <Card>
          <CardHeader title="Hospedagem (equipe técnica)" subtitle="O que o sistema não consegue fazer sozinho: colocar o site na internet." />
          <CardBody>
            <ol className="store-steps" style={{ color: 'var(--color-text)' }}>
              <li>Contratar hospedagem: servidor próprio (VPS) com Node 22+ e disco persistente, ou nuvem serverless com banco Turso.</li>
              <li>Registrar o domínio e ativar o HTTPS (certificado).</li>
              <li>Configurar as variáveis de ambiente (endereço público, banco) e criar o banco <strong>sem</strong> dados de demonstração.</li>
              <li>Agendar backup semanal e testar a restauração.</li>
              <li>Fazer um pedido de teste de ponta a ponta no endereço real (PIX de valor baixo, confirmar, concluir e estornar).</li>
            </ol>
            <p className="text-muted" style={{ marginTop: 12, fontSize: 'var(--text-sm)' }}>
              O passo a passo completo está em <code className="code-tag">docs/DEPLOY.md</code> e o funcionamento da loja em <code className="code-tag">docs/LOJA-VIRTUAL.md</code>.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
