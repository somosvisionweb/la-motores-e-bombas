/**
 * Pedidos recentes deste aparelho (localStorage): como a compra é feita sem cadastro, é assim que o cliente
 * volta ao acompanhamento sem precisar procurar o link. Os dados ficam só no navegador dele.
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'la-loja-pedidos-v1';
const MAX_ORDERS = 5;
const EMPTY: readonly RecentOrder[] = Object.freeze([]);
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export interface RecentOrder {
  token: string;
  number: number;
}

let snapshot: readonly RecentOrder[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): readonly RecentOrder[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return EMPTY;
    const valid = raw.filter((entry): entry is RecentOrder => typeof entry?.token === 'string' && TOKEN_RE.test(entry.token) && Number.isSafeInteger(entry?.number) && entry.number > 0);
    return Object.freeze(valid.slice(0, MAX_ORDERS));
  } catch {
    return EMPTY;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function ensureLoaded(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  snapshot = read();
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    snapshot = read();
    emit();
  });
}

function subscribe(listener: () => void): () => void {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): readonly RecentOrder[] {
  ensureLoaded();
  return snapshot;
}

/** Guarda (ou sobe para o topo) um pedido visto neste aparelho. */
export function rememberOrder(order: RecentOrder): void {
  ensureLoaded();
  if (!TOKEN_RE.test(order.token)) return;
  const next = [order, ...snapshot.filter((entry) => entry.token !== order.token)].slice(0, MAX_ORDERS);
  snapshot = Object.freeze(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
  emit();
}

export function useRecentOrders(): readonly RecentOrder[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
