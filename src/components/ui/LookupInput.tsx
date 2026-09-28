'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Campo com busca assíncrona (autocomplete): consulta `endpoint?q=…`, navega com ↑ ↓ Enter Esc
 * e devolve o item escolhido. O texto digitado continua livre (útil para itens sem cadastro).
 */
export function LookupInput<T extends { id: number }>({
  endpoint,
  value,
  onValueChange,
  onPick,
  renderItem,
  placeholder,
  inputClassName,
  ariaLabel,
  autoFocus,
  emptyText = 'Nenhum resultado. Continue digitando para usar um texto livre.',
  minChars = 0,
  invalid,
  icon = true,
  inputRef,
  disabled,
  onEnterWithoutPick,
}: {
  endpoint: string;
  value: string;
  onValueChange: (text: string) => void;
  onPick: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  placeholder?: string;
  inputClassName?: string;
  ariaLabel: string;
  autoFocus?: boolean;
  emptyText?: string;
  minChars?: number;
  invalid?: boolean;
  icon?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  disabled?: boolean;
  onEnterWithoutPick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ query: string; items: T[] } | null>(null);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Os resultados guardam o texto que os gerou: enquanto o texto muda, resultados antigos nunca aparecem
  // (mostra "Buscando…" até a resposta da busca atual chegar).
  const query = value.trim();
  const eligible = open && query.length >= minChars;
  const items = eligible && result?.query === query ? result.items : [];
  const loading = eligible && result?.query !== query;

  // Busca (com atraso curto; respostas antigas são canceladas)
  useEffect(() => {
    if (!eligible) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(String(response.status));
        const json = (await response.json()) as { results?: T[] };
        setResult({ query, items: json.results ?? [] });
        setActive(0);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResult({ query, items: [] });
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [eligible, query, endpoint]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const pick = (item: T) => {
    onPick(item);
    setOpen(false);
  };

  return (
    <div className="lookup" ref={root}>
      <div className={cn(icon && 'search-input')}>
        {icon ? <Search aria-hidden="true" /> : null}
        <input
          ref={inputRef}
          type="text"
          className={cn('input', inputClassName)}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid ? true : undefined}
          role="combobox"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onValueChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(items.length - 1, i + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (event.key === 'Enter') {
              if (open && items[active]) {
                event.preventDefault();
                pick(items[active]!);
              } else if (onEnterWithoutPick) {
                event.preventDefault();
                onEnterWithoutPick();
              } else {
                event.preventDefault(); // Enter não deve enviar o formulário por acidente
              }
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
      </div>
      {open ? (
        <ul className="lookup__panel" id={listId} role="listbox">
          {loading && items.length === 0 ? <li className="lookup__empty">Buscando…</li> : null}
          {!loading && items.length === 0 ? <li className="lookup__empty">{emptyText}</li> : null}
          {items.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={index === active}
              className="lookup__item"
              onMouseDown={(event) => {
                event.preventDefault();
                pick(item);
              }}
              onMouseEnter={() => setActive(index)}
            >
              {renderItem(item)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
