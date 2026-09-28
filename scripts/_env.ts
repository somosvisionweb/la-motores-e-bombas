/** Carrega o arquivo .env (se existir) antes de qualquer acesso ao banco. */
import fs from 'node:fs';

if (fs.existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* .env inválido: segue com as variáveis do ambiente */
  }
}

export {};
