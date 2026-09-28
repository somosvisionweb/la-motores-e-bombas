'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pause, Play, Printer } from 'lucide-react';
import type { SaleDocument } from '@/server/documents/model';
import { SaleSheet } from './OrderSheets';

interface NewOrder {
  id: number;
  saleId: number;
  code: string;
  doc: SaleDocument;
}

interface PrintedEntry {
  key: string;
  saleId: number;
  code: string;
  buyer: string;
  time: string;
  test: boolean;
}

type Connection = 'starting' | 'ok' | 'error' | 'expired';

const POLL_MS = 15_000;
/** Guardado por aba: recarregar a página não perde o ponto onde parou; abrir uma aba nova começa "a partir de agora". */
const STORAGE_KEY = 'la-estacao-loja-ultimo-pedido';

function readPointer(latestOrderId: number): number {
  try {
    const stored = Number(window.sessionStorage.getItem(STORAGE_KEY));
    if (Number.isSafeInteger(stored) && stored > 0 && stored <= latestOrderId) return stored;
  } catch {
    /* navegador sem armazenamento: começa a partir de agora */
  }
  return latestOrderId;
}

function writePointer(id: number): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* sem armazenamento: vale só até recarregar */
  }
}

/** Espera a logo (e outras imagens) da folha carregarem antes de imprimir, no máximo `timeoutMs`. */
async function waitForImages(root: HTMLElement | null, timeoutMs = 2500): Promise<void> {
  const pending = Array.from(root?.querySelectorAll('img') ?? []).filter((img) => !img.complete);
  if (pending.length === 0) return;
  await Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

function clock(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * "Estação de impressão": fica aberta no computador da loja e imprime (A4) cada pedido novo do site assim que ele chega.
 * Consulta o servidor a cada 15 s, coloca o(s) pedido(s) novo(s) em folhas A4 escondidas na tela e chama a impressão
 * do navegador. Sem o modo "kiosk-printing" do Chrome, a janela de impressão abre a cada pedido.
 */
export function StorePrintStation({ latestOrderId }: { latestOrderId: number }) {
  const [active, setActive] = useState(true);
  const [connection, setConnection] = useState<Connection>('starting');
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [batch, setBatch] = useState<{ orders: NewOrder[]; test: boolean }>({ orders: [], test: false });
  const [printed, setPrinted] = useState<PrintedEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  /** Último pedido já tratado (o próximo `depois=` da consulta). */
  const pointerRef = useRef<number | null>(null);
  /** Para onde o ponteiro vai quando o lote atual terminar de imprimir. */
  const nextPointerRef = useRef(0);
  const busyRef = useRef(false);
  const printingRef = useRef(false);
  const sheetsRef = useRef<HTMLDivElement>(null);

  const startBatch = useCallback((orders: NewOrder[], nextPointer: number, test: boolean) => {
    nextPointerRef.current = nextPointer;
    printingRef.current = true;
    setBatch({ orders, test });
  }, []);

  const poll = useCallback(async () => {
    if (busyRef.current || printingRef.current) return;
    busyRef.current = true;
    try {
      pointerRef.current ??= readPointer(latestOrderId);
      const response = await fetch(`/api/loja/pedidos-novos?depois=${pointerRef.current}`, { cache: 'no-store' });
      if (response.status === 401) {
        setConnection('expired');
        return;
      }
      if (!response.ok) {
        setConnection('error');
        return;
      }
      const data = (await response.json()) as { upTo: number; orders: NewOrder[] };
      setConnection('ok');
      setCheckedAt(new Date());
      if (data.orders.length > 0) {
        startBatch(data.orders, data.upTo, false);
      } else if (data.upTo !== pointerRef.current) {
        pointerRef.current = data.upTo;
        writePointer(data.upTo);
      }
    } catch {
      setConnection('error');
    } finally {
      busyRef.current = false;
    }
  }, [latestOrderId, startBatch]);

  /** Imprime de novo o pedido mais recente (para testar a impressora); não mexe no ponto onde a estação parou. */
  const testPrint = useCallback(async () => {
    if (busyRef.current || printingRef.current) return;
    busyRef.current = true;
    setNotice(null);
    try {
      pointerRef.current ??= readPointer(latestOrderId);
      const response = await fetch('/api/loja/pedidos-novos?ultimo=1', { cache: 'no-store' });
      if (!response.ok) {
        setNotice(response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : 'Não foi possível buscar o pedido agora. Tente de novo.');
        return;
      }
      const data = (await response.json()) as { orders: NewOrder[] };
      if (data.orders.length === 0) setNotice('Ainda não há pedidos para imprimir.');
      else startBatch(data.orders, pointerRef.current, true);
    } catch {
      setNotice('Não foi possível buscar o pedido agora. Tente de novo.');
    } finally {
      busyRef.current = false;
    }
  }, [latestOrderId, startBatch]);

  // Consulta o servidor de tempos em tempos (e assim que a aba volta a ficar visível: abas ao fundo são desaceleradas).
  useEffect(() => {
    if (!active) return;
    const first = window.setTimeout(() => void poll(), 0);
    const timer = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, poll]);

  // Chegou um lote: espera a logo carregar, chama a impressão e, ao terminar, avança o ponteiro.
  useEffect(() => {
    if (batch.orders.length === 0) return;
    let cancelled = false;
    let listener: (() => void) | null = null;

    const finish = () => {
      if (listener) window.removeEventListener('afterprint', listener);
      listener = null;
      if (!batch.test) {
        pointerRef.current = nextPointerRef.current;
        writePointer(nextPointerRef.current);
      }
      const time = clock(new Date());
      setPrinted((previous) =>
        [...batch.orders.map((order) => ({ key: `${order.id}-${time}`, saleId: order.saleId, code: order.code, buyer: order.doc.customer.name, time, test: batch.test })), ...previous].slice(0, 30),
      );
      printingRef.current = false;
      setBatch({ orders: [], test: false });
    };

    void (async () => {
      await waitForImages(sheetsRef.current);
      if (cancelled) return;
      listener = finish;
      window.addEventListener('afterprint', finish, { once: true });
      window.print();
    })();

    return () => {
      cancelled = true;
      if (listener) window.removeEventListener('afterprint', listener);
    };
  }, [batch]);

  const printing = batch.orders.length > 0;
  const state = !active ? 'paused' : printing ? 'printing' : connection;
  const headline: Record<string, string> = {
    paused: 'Impressão automática pausada',
    printing: `Imprimindo ${batch.orders.length === 1 ? 'o pedido' : 'os pedidos'} ${batch.orders.map((order) => order.code).join(', ')}…`,
    starting: 'Conectando ao sistema…',
    ok: 'Aguardando novos pedidos do site',
    error: 'Sem conexão com o sistema — tentando de novo',
    expired: 'Sua sessão expirou',
  };

  return (
    <>
      <div className="doc-toolbar no-print">
        <Link href="/sistema/loja" className="btn btn--sm">
          <ArrowLeft aria-hidden="true" /> Voltar
        </Link>
        <span className="doc-toolbar__title">Impressão automática dos pedidos da loja</span>
        <button type="button" className="btn btn--sm" onClick={() => void testPrint()} disabled={printing}>
          <Printer aria-hidden="true" /> Imprimir o último pedido (teste)
        </button>
        <button type="button" className="btn btn--sm" onClick={() => setActive((value) => !value)}>
          {active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {active ? 'Pausar' : 'Retomar'}
        </button>
      </div>

      <div className="station no-print">
        <section className={`station__card station__card--${state}`} aria-live="polite">
          <p className="station__status">
            <span className="station__dot" aria-hidden="true" />
            {headline[state]}
          </p>
          <p className="station__meta">
            {state === 'expired' ? (
              <>
                Entre de novo para continuar imprimindo. <a href="/login">Ir para o login</a>
              </>
            ) : active ? (
              <>Consulta o sistema a cada {POLL_MS / 1000} segundos{checkedAt ? ` · última verificação às ${clock(checkedAt)}` : ''}.</>
            ) : (
              'Nenhum pedido novo será impresso enquanto estiver pausada.'
            )}
          </p>
          {notice ? (
            <p className="station__notice" role="status">
              {notice}
            </p>
          ) : null}
        </section>

        <section className="station__card">
          <h2>Como usar</h2>
          <ol>
            <li>Deixe esta página aberta no computador ligado à impressora, de preferência em uma janela só para ela.</li>
            <li>Cada pedido novo do site é impresso em uma folha A4 assim que chega. Pedidos cancelados não são impressos.</li>
            <li>
              A janela de impressão do navegador abre a cada pedido. Para imprimir direto, sem a janela, abra o Chrome com a opção <code>--kiosk-printing</code> (passo a passo no manual do usuário).
            </li>
            <li>Pedidos que chegarem com esta página fechada não são impressos automaticamente: eles continuam na tela <strong>Loja online</strong>, onde dá para imprimir um a um.</li>
          </ol>
        </section>

        {printed.length > 0 ? (
          <section className="station__card">
            <h2>Impressos nesta sessão</h2>
            <ul className="station__list">
              {printed.map((entry) => (
                <li key={entry.key}>
                  <span>
                    <strong>{entry.code}</strong> · {entry.buyer}
                    {entry.test ? ' (teste)' : ''}
                  </span>
                  <span className="station__time">{entry.time}</span>
                  <a href={`/imprimir/venda/${entry.saleId}?auto=1`} target="_blank" rel="noopener noreferrer">
                    Imprimir de novo
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {/* Folhas A4 do lote atual: escondidas na tela, só aparecem na impressão. */}
      <div className="station-sheets" ref={sheetsRef} aria-hidden="true">
        {batch.orders.map((order) => (
          <SaleSheet key={order.id} doc={order.doc} />
        ))}
      </div>
    </>
  );
}
