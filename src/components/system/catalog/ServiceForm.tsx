'use client';

import Link from 'next/link';
import type { ActionState } from '@/lib/action-state';
import { SERVICE_GROUPS } from '@/config/official-catalog';
import { ActionForm } from '@/components/form/ActionForm';
import { CheckboxField, HiddenField, MoneyField, TextareaField, TextField } from '@/components/form/fields';
import { SubmitButton } from '@/components/ui/SubmitButton';
import type { Service } from '@/server/db/schema';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ServiceForm({ action, service, categories }: { action: Action; service?: Service; categories: string[] }) {
  const options = [...new Set([...SERVICE_GROUPS, ...categories])];
  return (
    <ActionForm action={action} className="stack" successToast={false}>
      {service ? <HiddenField name="id" value={service.id} /> : null}
      <datalist id="service-categories">
        {options.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="form-grid">
        <TextField className="col-8" name="name" label="Nome do serviço" required defaultValue={service?.name} autoFocus={!service} />
        <TextField className="col-4" name="category" label="Grupo / categoria" required defaultValue={service?.category ?? 'Outros equipamentos'} list="service-categories" hint="Agrupa os serviços no site" />
        <MoneyField className="col-4" name="defaultPriceCents" label="Preço padrão (opcional)" defaultCents={service?.defaultPriceCents ?? null} nullable hint="Vazio = a combinar" />
        <TextField className="col-4" name="sortOrder" label="Ordem de exibição" type="number" min={0} defaultValue={service?.sortOrder ?? 0} inputMode="numeric" />
        <div className="col-4" />
        <TextareaField className="col-12" name="description" label="Descrição (opcional)" defaultValue={service?.description} rows={3} maxLength={400} hint="Usada no site e como sugestão na OS." />
        <CheckboxField className="col-6" name="isActive" label="Serviço ativo (aparece na OS)" defaultChecked={service?.isActive ?? true} />
        <CheckboxField className="col-6" name="showOnSite" label="Exibir no site público" defaultChecked={service?.showOnSite ?? true} />
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">{service ? 'Salvar alterações' : 'Cadastrar serviço'}</SubmitButton>
        <Link href="/sistema/servicos" className="btn">
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}
