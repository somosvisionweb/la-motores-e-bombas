/**
 * Carrinho no navegador (localStorage), exposto ao React com `useSyncExternalStore`.
 * Guarda só "produto + quantidade": preços e estoque são sempre conferidos pelo servidor.
 * Funciona entre abas (evento `storage`) e sobrevive a recarregar a página.
 */
import { useSyncExternalStore } from 'react';
import { CART_MAX_LINES, CART_MAX_QTY } from '@/config/store';
import { sanitizeCartInput, type CartInputLine } from '@/lib/store-cart';

const STORAGE_KEY = 'la-loja-carrinho-v1';
const EMPTY: readonly CartInputLine[] = Object.freeze([]);

let snapshot: readonly CartInputLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function readStorage(): readonly CartInputLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return Object.freeze(sanitizeCartInput(raw ? JSON.parse(raw) : []));
  } catch {
    return EMPTY;
  }
}

function writeStorage(items: readonly CartInputLine[]): void {
  try {
    if (items.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* navegador sem armazenamento (modo privado): o carrinho vale só nesta aba */
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  snapshot = readStorage();
  emit();
}

function ensureLoaded(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  snapshot = readStorage();
  window.addEventListener('storage', onStorage);
}

function commit(next: CartInputLine[]): void {
  snapshot = Object.freeze(next);
  writeStorage(snapshot);
  emit();
}

function subscribe(listener: () => void): () => void {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): readonly CartInputLine[] {
  ensureLoaded();
  return snapshot;
}

export interface AddResult {
  /** Quantidade que passou a estar no carrinho para este produto. */
  quantity: number;
  /** Bateu no limite (estoque disponível ou máximo por item) e não coube tudo. */
  capped: boolean;
  /** Carrinho cheio: não cabe mais um produto diferente. */
  full: boolean;
}

/** Adiciona `quantity` do produto (respeitando `max`, o estoque disponível quando conhecido). */
export function addToCart(productId: number, quantity = 1, max: number = CART_MAX_QTY): AddResult {
  ensureLoaded();
  const limit = Math.max(1, Math.min(CART_MAX_QTY, max));
  const current = snapshot.find((line) => line.id === productId);
  if (!current && snapshot.length >= CART_MAX_LINES) return { quantity: 0, capped: false, full: true };
  const wanted = (current?.qty ?? 0) + Math.max(1, Math.floor(quantity));
  const next = Math.min(limit, wanted);
  const lines = current ? snapshot.map((line) => (line.id === productId ? { id: productId, qty: next } : line)) : [...snapshot, { id: productId, qty: next }];
  commit(lines);
  return { quantity: next, capped: wanted > next, full: false };
}

/** Define a quantidade de um produto (0 ou menos remove). */
export function setCartQuantity(productId: number, quantity: number): void {
  ensureLoaded();
  const qty = Math.min(CART_MAX_QTY, Math.floor(quantity));
  if (qty <= 0) commit(snapshot.filter((line) => line.id !== productId));
  else commit(snapshot.map((line) => (line.id === productId ? { id: productId, qty } : line)));
}

export function removeFromCart(productId: number): void {
  setCartQuantity(productId, 0);
}

export function clearCart(): void {
  ensureLoaded();
  if (snapshot.length > 0) commit([]);
}

/** Substitui o carrinho inteiro (usado para corrigir problemas apontados pelo servidor). */
export function replaceCart(lines: CartInputLine[]): void {
  ensureLoaded();
  commit(sanitizeCartInput(lines));
}

export function useCart(): { items: readonly CartInputLine[]; count: number } {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return { items, count: items.reduce((sum, line) => sum + line.qty, 0) };
}

// ---------------------------------------------------------------------------
// Gaveta do carrinho (aberta/fechada)
// ---------------------------------------------------------------------------

interface DrawerState {
  open: boolean;
  /** Já foi aberta alguma vez (o conteúdo só é montado — e o servidor consultado — depois disso). */
  everOpened: boolean;
}

const DRAWER_CLOSED: DrawerState = { open: false, everOpened: false };
let drawer: DrawerState = DRAWER_CLOSED;
const drawerListeners = new Set<() => void>();

export function setCartDrawerOpen(open: boolean): void {
  if (drawer.open === open) return;
  drawer = { open, everOpened: drawer.everOpened || open };
  for (const listener of drawerListeners) listener();
}

function subscribeDrawer(listener: () => void): () => void {
  drawerListeners.add(listener);
  return () => {
    drawerListeners.delete(listener);
  };
}

export function useCartDrawer(): DrawerState {
  return useSyncExternalStore(subscribeDrawer, () => drawer, () => DRAWER_CLOSED);
}
