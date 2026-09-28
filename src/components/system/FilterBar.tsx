import Link from 'next/link';
import { Search } from 'lucide-react';
import { AutoSubmitForm } from '@/components/ui/Interactions';

/** Barra de filtros de listagem: formulário GET (funciona sem JavaScript e mantém a URL compartilhável). */
export function FilterBar({
  children,
  clearHref,
  hasFilters,
  keep,
}: {
  children: React.ReactNode;
  clearHref: string;
  hasFilters: boolean;
  /** Parâmetros que devem sobreviver ao filtrar (ex.: ordenação atual). */
  keep?: Record<string, string | undefined>;
}) {
  return (
    <AutoSubmitForm className="filters">
      {Object.entries(keep ?? {}).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      {children}
      <div className="filters__actions">
        <button type="submit" className="btn btn--brand">
          <Search aria-hidden="true" /> Filtrar
        </button>
        {hasFilters ? (
          <Link href={clearHref} className="btn btn--ghost">
            Limpar
          </Link>
        ) : null}
      </div>
    </AutoSubmitForm>
  );
}

export function SearchField({
  name = 'q',
  defaultValue,
  placeholder,
  label = 'Buscar',
}: {
  name?: string;
  defaultValue?: string;
  placeholder: string;
  label?: string;
}) {
  return (
    <div className="field field--search">
      <label className="field__label" htmlFor={`f-${name}`}>
        {label}
      </label>
      <div className="search-input">
        <Search aria-hidden="true" />
        <input id={`f-${name}`} name={name} type="search" className="input" defaultValue={defaultValue} placeholder={placeholder} autoComplete="off" />
      </div>
    </div>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  options,
  allLabel = 'Todos',
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={`f-${name}`}>
        {label}
      </label>
      <select id={`f-${name}`} name={name} className="select" defaultValue={defaultValue ?? ''}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
