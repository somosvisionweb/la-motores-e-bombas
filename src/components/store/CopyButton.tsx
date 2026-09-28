'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Alternativa para navegadores sem a API de área de transferência (ou página sem HTTPS).
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }
}

/** Copia um texto (ex.: PIX "copia e cola") e confirma com "Copiado!". */
export function CopyButton({ text, label = 'Copiar código', className }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function onClick() {
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'failed');
    window.setTimeout(() => setState('idle'), 2500);
  }

  return (
    <button type="button" className={className ?? 'btn btn--primary'} onClick={onClick}>
      {state === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span aria-live="polite">{state === 'copied' ? 'Copiado!' : state === 'failed' ? 'Não foi possível copiar' : label}</span>
    </button>
  );
}
