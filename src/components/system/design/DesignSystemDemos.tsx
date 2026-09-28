'use client';

import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Menu } from '@/components/ui/Menu';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

function toHex(color: string): string {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return color.trim();
  return `#${[match[1], match[2], match[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

/** Amostras de cor lidas das variáveis CSS reais (`tokens.css`): o guia nunca fica desatualizado. */
export function TokenSwatches({ tokens }: { tokens: string[] }) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    // Um elemento de teste por cor: o navegador resolve `var(--token)` (inclusive tokens que apontam para outros).
    const probes = tokens.map((token) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      document.body.appendChild(probe);
      return { token, probe };
    });
    const next: Record<string, string> = {};
    for (const { token, probe } of probes) {
      next[token] = toHex(getComputedStyle(probe).color);
      probe.remove();
    }
    const frame = requestAnimationFrame(() => setValues(next));
    return () => cancelAnimationFrame(frame);
  }, [tokens]);

  return (
    <ul className="ds-swatches">
      {tokens.map((token) => (
        <li key={token}>
          <span className="ds-swatch" style={{ background: `var(${token})` }} aria-hidden="true" />
          <code>{token}</code>
          <small>{values[token] ?? ' '}</small>
        </li>
      ))}
    </ul>
  );
}

export function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Abrir modal
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Exemplo de modal"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setOpen(false)}>
              Confirmar
            </button>
          </>
        }
      >
        <p>Modais usam o elemento nativo &lt;dialog&gt;: o foco fica preso dentro dele, Esc e o clique fora fecham, e o fundo é escurecido.</p>
      </Modal>
    </>
  );
}

export function MenuDemo() {
  const toast = useToast();
  return (
    <Menu label="Abrir menu de exemplo" trigger={<>Ações ▾</>}>
      <p className="menu__label">Registro</p>
      <button type="button" className="menu__item" onClick={() => toast.info('Editar (exemplo)')}>
        <Pencil aria-hidden="true" /> Editar
      </button>
      <button type="button" className="menu__item" onClick={() => toast.info('Duplicar (exemplo)')}>
        <Copy aria-hidden="true" /> Duplicar
      </button>
      <button type="button" className="menu__item menu__item--danger" onClick={() => toast.error('Excluir (exemplo)')}>
        <Trash2 aria-hidden="true" /> Excluir
      </button>
    </Menu>
  );
}

export function ToastDemo() {
  const toast = useToast();
  return (
    <div className="cluster">
      <button type="button" className="btn" onClick={() => toast.success('Salvo com sucesso.')}>
        Sucesso
      </button>
      <button type="button" className="btn" onClick={() => toast.info('Informação para o usuário.')}>
        Informação
      </button>
      <button type="button" className="btn" onClick={() => toast.error('Algo deu errado. Tente novamente.')}>
        Erro
      </button>
    </div>
  );
}
