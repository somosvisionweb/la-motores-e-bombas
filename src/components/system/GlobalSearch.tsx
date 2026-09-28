'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, ClipboardList, Cog, Search, ShoppingCart, Store, Users } from 'lucide-react';

interface Result {
  type: 'customer' | 'order' | 'product' | 'service' | 'sale' | 'store';
  id: number;
  title: string;
  subtitle: string;
  href: string;
}
interface Group {
  label: string;
  items: Result[];
}

const ICONS = { customer: Users, order: ClipboardList, product: Boxes, service: Cog, sale: ShoppingCart, store: Store } as const;

/** Busca global (atalhos: "/" ou Ctrl+K). Digite um nome, telefone, OS-000123, produto ou serviço. */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [fetchedGroups, setGroups] = useState<Group[]>([]);
  const [fetchedDirect, setDirect] = useState<Result | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // Consulta curta: nenhum resultado (sem precisar limpar o estado em um efeito).
  const searching = query.trim().length >= 2;
  const groups = searching ? fetchedGroups : [];
  const direct = searching ? fetchedDirect : null;
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if ((event.key === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const json = (await response.json()) as { groups: Group[]; direct: Result | null };
        setGroups(json.groups);
        setDirect(json.direct);
        setActive(0);
      } catch {
        /* ignorado: mantém os resultados anteriores */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    input.current?.blur();
    router.push(href);
  };

  return (
    <div className="global-search" ref={root} role="search">
      <div className="global-search__field">
        <Search aria-hidden="true" />
        <input
          ref={input}
          className="global-search__input"
          type="search"
          value={query}
          placeholder="Buscar cliente, telefone, OS-000123, produto…"
          aria-label="Busca global"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              input.current?.blur();
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((i) => Math.min(flat.length - 1, i + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const target = direct ?? flat[active];
              if (target) go(target.href);
            }
          }}
        />
        <span className="global-search__hint kbd" aria-hidden="true">
          /
        </span>
      </div>
      {open && query.trim().length >= 2 ? (
        <div className="global-search__panel" role="listbox">
          {loading && flat.length === 0 ? <p className="global-search__empty">Buscando…</p> : null}
          {!loading && flat.length === 0 ? <p className="global-search__empty">Nada encontrado para “{query.trim()}”.</p> : null}
          {groups.map((group) => (
            <div key={group.label}>
              <p className="global-search__group">{group.label}</p>
              {group.items.map((item) => {
                const Icon = ICONS[item.type];
                const index = flat.indexOf(item);
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    className="global-search__item"
                    role="option"
                    aria-selected={index === active}
                    style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item.href)}
                  >
                    <Icon aria-hidden="true" />
                    <span>
                      <span className="global-search__item-title">{item.title}</span>
                      <span className="global-search__item-sub" style={{ display: 'block' }}>
                        {item.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
