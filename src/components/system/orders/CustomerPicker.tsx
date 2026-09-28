'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserPlus, X } from 'lucide-react';
import { useFormState } from '@/components/form/ActionForm';
import { DemoBadge } from '@/components/ui/Badge';
import { LookupInput } from '@/components/ui/LookupInput';
import { displayPhone } from '@/lib/phone';
import { initials } from '@/lib/text';

export interface PickedCustomer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  isDemo?: boolean;
}

/** Seleção do cliente da OS (busca por nome/telefone) com atalho para cadastrar um novo. */
export function CustomerPicker({
  initial,
  newCustomerHref,
  canCreate,
  optional = false,
}: {
  initial: PickedCustomer | null;
  newCustomerHref: string;
  canCreate: boolean;
  /** Vendas de balcão podem ser feitas sem cliente ("consumidor final"). */
  optional?: boolean;
}) {
  const [selected, setSelected] = useState<PickedCustomer | null>(initial);
  const [text, setText] = useState('');
  const { state } = useFormState();
  const error = state.fieldErrors?.customerId;

  return (
    <div className="field">
      <span className="field__label" id="customer-label">
        {optional ? 'Cliente (opcional)' : 'Cliente'}{' '}
        {optional ? null : (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <input type="hidden" name="customerId" value={selected?.id ?? ''} />
      {selected ? (
        <div className="picked-customer">
          <span className="avatar" aria-hidden="true">
            {initials(selected.name)}
          </span>
          <div className="grow">
            <p style={{ fontWeight: 600 }}>
              <Link href={`/sistema/clientes/${selected.id}`} target="_blank">
                {selected.name}
              </Link>{' '}
              {selected.isDemo ? <DemoBadge /> : null}
            </p>
            <p className="text-muted" style={{ fontSize: 13 }}>
              {[displayPhone(selected.phone), selected.address].filter(Boolean).join(' · ') || 'Sem telefone ou endereço cadastrado'}
            </p>
          </div>
          <button type="button" className="btn btn--sm" onClick={() => setSelected(null)}>
            <X aria-hidden="true" /> Trocar
          </button>
        </div>
      ) : (
        <div className="cluster" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 12 }}>
          <div className="grow">
            <LookupInput<PickedCustomer>
              endpoint="/api/lookup/customers"
              value={text}
              onValueChange={setText}
              onPick={(customer) => {
                setSelected(customer);
                setText('');
              }}
              ariaLabel="Buscar cliente por nome ou telefone"
              placeholder={optional ? 'Deixe em branco para consumidor final ou busque um cliente…' : 'Digite o nome ou telefone do cliente…'}
              autoFocus={!optional}
              invalid={Boolean(error)}
              emptyText="Nenhum cliente encontrado. Cadastre um novo cliente."
              renderItem={(customer) => (
                <>
                  <span className="avatar avatar--sm" aria-hidden="true">
                    {initials(customer.name)}
                  </span>
                  <span>
                    <span style={{ fontWeight: 600 }}>{customer.name}</span> {customer.isDemo ? <DemoBadge /> : null}
                    <span className="text-muted" style={{ display: 'block', fontSize: 13 }}>
                      {[displayPhone(customer.phone), customer.address].filter(Boolean).join(' · ') || 'Sem contato'}
                    </span>
                  </span>
                </>
              )}
            />
          </div>
          {canCreate ? (
            <Link href={newCustomerHref} className="btn">
              <UserPlus aria-hidden="true" /> Novo cliente
            </Link>
          ) : null}
        </div>
      )}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : (
        <p className="field__hint">
          {optional ? 'Sem cliente, a venda é registrada como consumidor final.' : 'Se o cliente ainda não existe, cadastre-o e você voltará automaticamente para esta ordem.'}
        </p>
      )}
    </div>
  );
}
