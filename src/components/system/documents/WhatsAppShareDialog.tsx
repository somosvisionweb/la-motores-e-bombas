'use client';

import { useState, useSyncExternalStore } from 'react';
import { Copy, FileDown, Share2 } from 'lucide-react';
import { createShareLinkAction, logDocumentSentAction } from '@/actions/documents';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { buildWhatsAppUrl, displayPhone, formatPhoneBR, toWhatsAppNumber } from '@/lib/phone';

export interface ShareTarget {
  type: 'ORDER' | 'SALE' | 'RECEIPT';
  refId: number;
  code: string;
  customerName: string;
  /** Número do cliente (formato do WhatsApp) ou null se não houver. */
  whatsappNumber: string | null;
  /** Mensagem base (sem o link). */
  message: string;
  pdfHref: string;
  baseUrl: string;
  baseUrlIsLocal: boolean;
}

const subscribeNever = () => () => {};

function detectFileSharing(): boolean {
  try {
    const probe = new File(['x'], 'x.pdf', { type: 'application/pdf' });
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Fluxo "Enviar pelo WhatsApp". LIMITAÇÃO REAL da plataforma: links do WhatsApp (wa.me) não anexam arquivos.
 * Por isso o sistema (1) gera o PDF, (2) cria um link seguro para baixá-lo, (3) abre a conversa com a mensagem
 * e o link. Em celulares com suporte, também é possível compartilhar o PDF como anexo pelo menu do sistema.
 */
export function WhatsAppShareDialog({ target, open, onClose }: { target: ShareTarget; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [number, setNumber] = useState(target.whatsappNumber ? displayPhone(target.whatsappNumber.replace(/^55/, '')) : '');
  const [text, setText] = useState(target.message);
  const [includeLink, setIncludeLink] = useState(!target.baseUrlIsLocal);
  const [busy, setBusy] = useState(false);
  // Só no navegador (no servidor e na hidratação vale "não"): celulares com compartilhamento de arquivos.
  const canShareFiles = useSyncExternalStore(subscribeNever, detectFileSharing, () => false);

  const digits = toWhatsAppNumber(number);

  async function openWhatsApp() {
    if (!digits) {
      toast.error('Informe o número do WhatsApp do cliente, com DDD.');
      return;
    }
    setBusy(true);
    // abre a janela já no clique (evita bloqueio de pop-up) e preenche o endereço depois
    const popup = window.open('about:blank', '_blank');
    let finalText = text.trim();
    if (includeLink) {
      const result = await createShareLinkAction(target.type, target.refId);
      if (!result.ok || !result.url) {
        popup?.close();
        toast.error(result.message ?? 'Não foi possível gerar o link do PDF.');
        setBusy(false);
        return;
      }
      finalText = `${finalText}\n\n${result.url}`;
    }
    const url = buildWhatsAppUrl(digits, finalText);
    if (popup) {
      popup.opener = null;
      popup.location.href = url;
    } else {
      window.location.assign(url);
    }
    void logDocumentSentAction(target.type, target.refId, includeLink);
    setBusy(false);
    onClose();
  }

  async function sharePdf() {
    try {
      setBusy(true);
      const response = await fetch(target.pdfHref);
      if (!response.ok) throw new Error('pdf');
      const blob = await response.blob();
      const file = new File([blob], `${target.code}.pdf`, { type: 'application/pdf' });
      await navigator.share({ files: [file], text: text.trim(), title: target.code });
      void logDocumentSentAction(target.type, target.refId, false);
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') toast.error('Não foi possível compartilhar o PDF neste dispositivo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar pelo WhatsApp" size="lg">
      <div className="stack" style={{ ['--gap' as string]: '16px' }}>
        <Alert variant="info" title="Como funciona o envio">
          O WhatsApp <strong>não permite anexar arquivos automaticamente</strong> por link. O sistema abre a conversa com a mensagem pronta
          {includeLink ? ' e um link seguro para baixar o PDF' : ''}. Se preferir enviar o arquivo, use “Baixar PDF” e anexe manualmente na conversa
          {canShareFiles ? ' ou use “Compartilhar PDF” neste aparelho' : ''}.
        </Alert>

        <div className="field">
          <label className="field__label" htmlFor="wa-number">
            WhatsApp de {target.customerName.split(' ')[0]}
          </label>
          <input id="wa-number" className="input tabular" inputMode="tel" value={number} onChange={(e) => setNumber(formatPhoneBR(e.target.value))} placeholder="(81) 99999-9999" aria-invalid={number !== '' && !digits} />
          {number !== '' && !digits ? <p className="field__error">Número incompleto. Informe DDD + telefone.</p> : null}
          {!target.whatsappNumber && !number ? <p className="field__hint">Este cliente não tem telefone cadastrado. Informe o número para continuar.</p> : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="wa-text">
            Mensagem
          </label>
          <textarea id="wa-text" className="textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={900} />
        </div>

        <label className="check">
          <input type="checkbox" checked={includeLink} onChange={(e) => setIncludeLink(e.target.checked)} />
          Incluir link para baixar o PDF na mensagem
        </label>
        {includeLink && target.baseUrlIsLocal ? (
          <Alert variant="warning" title="Endereço local">
            O sistema está acessível apenas em <strong>{target.baseUrl}</strong>. O cliente só conseguirá abrir o link quando o sistema estiver publicado na internet (defina o
            endereço público em Configurações → Empresa).
          </Alert>
        ) : null}

        <div className="cluster" style={{ justifyContent: 'flex-end' }}>
          <a href={target.pdfHref.includes('?') ? target.pdfHref : `${target.pdfHref}?download=1`} className="btn">
            <FileDown aria-hidden="true" /> Baixar PDF
          </a>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text.trim());
                toast.success('Mensagem copiada.');
              } catch {
                toast.error('Não foi possível copiar.');
              }
            }}
          >
            <Copy aria-hidden="true" /> Copiar mensagem
          </button>
          {canShareFiles ? (
            <button type="button" className="btn" onClick={sharePdf} disabled={busy}>
              <Share2 aria-hidden="true" /> Compartilhar PDF
            </button>
          ) : null}
          <button type="button" className="btn btn--primary" onClick={openWhatsApp} disabled={busy || !digits}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <WhatsAppIcon />}
            Abrir WhatsApp
          </button>
        </div>
      </div>
    </Modal>
  );
}
