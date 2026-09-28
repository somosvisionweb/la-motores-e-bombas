/**
 * Conexão com o banco (libSQL/SQLite).
 *
 * - Local: arquivo (`DATABASE_URL=file:./data/la-motores.db`).
 * - Produção em nuvem: Turso (`libsql://...` + `DATABASE_AUTH_TOKEN`) sem alterar o código.
 *
 * REGRA DE ESCRITA: toda gravação passa por `runWrite`. O SQLite aceita um único escritor por vez;
 * `runWrite` enfileira as transações neste processo (evita `SQLITE_BUSY`) e reaproveita a transação
 * corrente quando chamado de dentro de outra (chamadas aninhadas não travam).
 * Leituras usam `getDb()` diretamente e podem acontecer em paralelo (modo WAL).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export type Database = LibSQLDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Aceita tanto a conexão quanto uma transação: funções de consulta reutilizáveis usam este tipo. */
export type DbOrTx = Database | Tx;

interface DbState {
  url: string;
  client: Client;
  db: Database;
  ready: Promise<void>;
}

interface Globals {
  __laDb?: DbState;
  __laWriteChain?: Promise<unknown>;
  __laTxStore?: AsyncLocalStorage<Tx>;
}

const g = globalThis as unknown as Globals;
const txStore = (g.__laTxStore ??= new AsyncLocalStorage<Tx>());

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || 'file:./data/la-motores.db';
}

function isLocalFile(url: string): boolean {
  return url.startsWith('file:');
}

function createState(url: string): DbState {
  if (isLocalFile(url)) {
    const filePath = url.slice('file:'.length);
    if (filePath && filePath !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    }
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  const db = drizzle(client, { schema });
  const ready = isLocalFile(url)
    ? (async () => {
        // WAL: leituras concorrentes com uma escrita; NORMAL é seguro com WAL.
        await client.execute('PRAGMA journal_mode = WAL');
        await client.execute('PRAGMA synchronous = NORMAL');
      })().catch(() => undefined)
    : Promise.resolve();
  return { url, client, db, ready };
}

function getState(): DbState {
  const url = getDatabaseUrl();
  if (!g.__laDb || g.__laDb.url !== url) {
    g.__laDb?.client.close();
    g.__laDb = createState(url);
  }
  return g.__laDb;
}

/** Conexão para leitura (e para migrações). Nunca grave fora de `runWrite`. */
export function getDb(): Database {
  return getState().db;
}

export function getRawClient(): Client {
  return getState().client;
}

/** Fecha a conexão (scripts e testes). */
export function closeDb(): void {
  g.__laDb?.client.close();
  g.__laDb = undefined;
}

/**
 * Executa `fn` dentro de uma transação de escrita, em fila.
 * Se já estiver dentro de uma transação (chamada aninhada), reutiliza a corrente.
 */
export function runWrite<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const current = txStore.getStore();
  if (current) return fn(current);

  const state = getState();
  const run = (g.__laWriteChain ?? Promise.resolve()).then(async () => {
    await state.ready;
    return state.db.transaction((tx) => txStore.run(tx, () => fn(tx)));
  });
  g.__laWriteChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Erro de violação de unicidade (usado para tentar novamente ao gerar números sequenciais). */
export function isUniqueViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${(error as { cause?: unknown }).cause ?? ''}` : String(error);
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY/i.test(text);
}

export function isForeignKeyViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${(error as { cause?: unknown }).cause ?? ''}` : String(error);
  return /FOREIGN KEY constraint failed|SQLITE_CONSTRAINT_FOREIGNKEY/i.test(text);
}
