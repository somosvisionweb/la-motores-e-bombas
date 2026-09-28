'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { createUserAction, resetPasswordAction, updateUserAction, type CredentialsData } from '@/actions/users';
import type { ActionState } from '@/lib/action-state';
import { PERMISSION_GROUPS } from '@/config/permissions';
import { ActionForm, useFormState } from '@/components/form/ActionForm';
import { CheckboxField, HiddenField, SelectField, TextareaField, TextField } from '@/components/form/fields';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/Interactions';
import { Modal } from '@/components/ui/Modal';
import { SubmitButton } from '@/components/ui/SubmitButton';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Senha temporária exibida UMA vez (o sistema não a guarda em texto). */
function CredentialsCard({ data }: { data: CredentialsData }) {
  const text = `Usuário: ${data.username}\nSenha temporária: ${data.temporaryPassword}`;
  return (
    <Alert variant="success" title={`Acesso de ${data.name || data.username}`}>
      <div className="stack" style={{ ['--gap' as string]: '10px', marginTop: 6 }}>
        <p>
          Anote agora: esta senha temporária <strong>não será exibida novamente</strong>. No primeiro acesso a troca é obrigatória.
        </p>
        <dl className="kv" style={{ gridTemplateColumns: 'auto 1fr' }}>
          <dt>Usuário</dt>
          <dd className="mono" style={{ fontWeight: 700 }}>
            {data.username}
          </dd>
          <dt>Senha temporária</dt>
          <dd className="mono" style={{ fontWeight: 700, fontSize: 18, letterSpacing: '0.04em' }}>
            {data.temporaryPassword}
          </dd>
        </dl>
        <div>
          <CopyButton text={text} label="Copiar usuário e senha" />
        </div>
      </div>
    </Alert>
  );
}

function CreatedCredentials() {
  const { state } = useFormState();
  const data = state.ok ? (state.data as CredentialsData | undefined) : undefined;
  return data ? <CredentialsCard data={data} /> : null;
}

export function UserForm({
  roles,
  user,
}: {
  roles: { id: number; name: string }[];
  user?: { id: number; name: string; username: string; email: string | null; roleId: number; isActive: boolean };
}) {
  const editing = Boolean(user);
  return (
    <ActionForm action={(editing ? updateUserAction : createUserAction) as Action} className="stack" successToast={false}>
      {user ? <HiddenField name="id" value={user.id} /> : null}
      <div className="form-grid">
        <TextField className="col-6" name="name" label="Nome completo" required defaultValue={user?.name} autoFocus />
        <TextField className="col-6" name="username" label="Usuário (login)" required defaultValue={user?.username} readOnly={editing} hint={editing ? 'O login não pode ser alterado.' : 'Minúsculas, números, ponto ou hífen.'} autoComplete="off" />
        <TextField className="col-6" name="email" label="E-mail (opcional)" type="email" defaultValue={user?.email} />
        <SelectField className="col-6" name="roleId" label="Perfil de acesso" required defaultValue={user?.roleId ?? ''} placeholder="Escolha…" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
        <CheckboxField className="col-12" name="isActive" label="Usuário ativo (pode entrar no sistema)" defaultChecked={user?.isActive ?? true} />
      </div>
      <CreatedCredentials />
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">{editing ? 'Salvar alterações' : 'Criar usuário'}</SubmitButton>
        <Link href="/sistema/usuarios" className="btn">
          Voltar
        </Link>
      </div>
    </ActionForm>
  );
}

export function ResetPasswordDialog({ userId, username, name }: { userId: number; username: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden="true" /> Redefinir senha
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Redefinir senha">
        <ActionForm action={resetPasswordAction as Action} className="stack" successToast={false}>
          <HiddenField name="id" value={userId} />
          <HiddenField name="username" value={username} />
          <HiddenField name="name" value={name} />
          <ResetBody name={name} onClose={() => setOpen(false)} />
        </ActionForm>
      </Modal>
    </>
  );
}

function ResetBody({ name, onClose }: { name: string; onClose: () => void }) {
  const { state } = useFormState();
  const data = state.ok ? (state.data as CredentialsData | undefined) : undefined;
  if (data) {
    return (
      <>
        <CredentialsCard data={data} />
        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <p>
        Será gerada uma nova senha temporária para <strong>{name}</strong>. As sessões abertas dele(a) serão encerradas e a troca de senha será exigida no próximo acesso.
      </p>
      <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose}>
          Cancelar
        </button>
        <SubmitButton variant="brand" pendingLabel="Gerando…">
          Gerar nova senha
        </SubmitButton>
      </div>
    </>
  );
}

export function RoleForm({
  action,
  role,
  readOnlyPermissions,
}: {
  action: Action;
  role?: { id: number; name: string; description: string | null; permissions: string[]; isSystem: boolean; key: string };
  readOnlyPermissions?: boolean;
}) {
  const selected = new Set(role?.permissions ?? []);
  return (
    <ActionForm action={action} className="stack" successToast={false}>
      {role ? <HiddenField name="id" value={role.id} /> : null}
      <div className="form-grid">
        <TextField className="col-6" name="name" label="Nome do perfil" required defaultValue={role?.name} autoFocus={!role} />
        <TextareaField className="col-12" name="description" label="Descrição" defaultValue={role?.description} rows={2} maxLength={200} />
      </div>
      {readOnlyPermissions ? (
        <Alert variant="info" title="Administrador">
          <ShieldCheck size={16} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-3px' }} /> O perfil Administrador sempre possui todas as permissões e não pode ser restringido.
        </Alert>
      ) : (
        <div className="stack" style={{ ['--gap' as string]: '14px' }}>
          <h2 className="form-section__title">Permissões</h2>
          <div className="perm-grid">
            {PERMISSION_GROUPS.map((group) => (
              <fieldset key={group.key} className="perm-group">
                <legend>{group.label}</legend>
                {group.permissions.map((permission) => (
                  <label key={permission.key} className="check">
                    <input type="checkbox" name="permissions" value={permission.key} defaultChecked={selected.has(permission.key)} />
                    {permission.label}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </div>
      )}
      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">{role ? 'Salvar perfil' : 'Criar perfil'}</SubmitButton>
        <Link href="/sistema/usuarios/perfis" className="btn">
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}
