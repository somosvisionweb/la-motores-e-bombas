import Link from 'next/link';
import { Cog, Pencil, Plus } from 'lucide-react';
import { deleteServiceAction } from '@/actions/services';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar, FilterSelect, SearchField } from '@/components/system/FilterBar';
import { param, type SearchParams } from '@/lib/query';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { listServiceCategories, listServices } from '@/server/services/catalog-services';
import { Trash2 } from 'lucide-react';

export const metadata = { title: 'Serviços' };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('services.view');
  const params = await searchParams;
  const q = param(params, 'q');
  const category = param(params, 'categoria');
  const canManage = hasPermission(user, 'services.manage');
  const [rows, categories] = await Promise.all([listServices({ q, category: category || undefined }), listServiceCategories()]);
  const basePath = '/sistema/servicos';

  return (
    <>
      <PageHeader
        title="Serviços"
        subtitle="Catálogo dos serviços oferecidos. Eles aparecem como sugestão na ordem de serviço e no site."
        actions={
          canManage ? (
            <Link href={`${basePath}/novo`} className="btn btn--primary">
              <Plus aria-hidden="true" /> Novo serviço
            </Link>
          ) : null
        }
      />
      <Card>
        <FilterBar clearHref={basePath} hasFilters={Boolean(q || category)}>
          <SearchField defaultValue={q} placeholder="Nome do serviço…" />
          <FilterSelect name="categoria" label="Grupo" defaultValue={category} options={categories.map((c) => ({ value: c, label: c }))} allLabel="Todos" />
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState icon={<Cog size={26} aria-hidden="true" />} title="Nenhum serviço encontrado">
            Ajuste a busca ou cadastre um novo serviço.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Serviço</th>
                  <th scope="col">Grupo</th>
                  <th scope="col" className="num">
                    Preço padrão
                  </th>
                  <th scope="col">Site</th>
                  {canManage ? <th scope="col" className="actions" /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-primary" data-label="">
                      {canManage ? <Link href={`${basePath}/${s.id}/editar`}>{s.name}</Link> : s.name}{' '}
                      {!s.isActive ? <Badge tone="slate">Inativo</Badge> : null}
                      {s.description ? <span className="cell-sub">{s.description}</span> : null}
                    </td>
                    <td data-label="Grupo" className="text-muted">
                      {s.category}
                    </td>
                    <td className="num" data-label="Preço padrão">
                      {s.defaultPriceCents !== null ? <Money cents={s.defaultPriceCents} /> : <span className="text-subtle">A combinar</span>}
                    </td>
                    <td data-label="Site">{s.showOnSite ? <Badge tone="green">Exibido</Badge> : <Badge tone="slate">Oculto</Badge>}</td>
                    {canManage ? (
                      <td className="actions" data-label="">
                        <span className="cluster" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          <Link href={`${basePath}/${s.id}/editar`} className="btn btn--sm btn--icon" aria-label={`Editar ${s.name}`} title="Editar">
                            <Pencil aria-hidden="true" />
                          </Link>
                          <ConfirmActionForm
                            action={deleteServiceAction}
                            fields={{ id: s.id }}
                            title="Excluir serviço?"
                            message={
                              <>
                                <strong>{s.name}</strong> será removido do catálogo. Ordens antigas não são afetadas (a descrição fica gravada nelas). Se preferir,
                                apenas desative o serviço.
                              </>
                            }
                            confirmLabel="Excluir serviço"
                            triggerLabel={`Excluir ${s.name}`}
                            triggerIcon={<Trash2 aria-hidden="true" />}
                            iconOnly
                          />
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            {rows.length} {rows.length === 1 ? 'serviço' : 'serviços'}
          </span>
        </div>
      </Card>
    </>
  );
}
