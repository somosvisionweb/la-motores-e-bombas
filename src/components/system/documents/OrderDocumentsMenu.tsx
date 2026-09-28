'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, FileDown, FileText, Printer } from 'lucide-react';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { Menu } from '@/components/ui/Menu';
import { WhatsAppShareDialog, type ShareTarget } from './WhatsAppShareDialog';

/** Menu "Documentos" da OS: imprimir (A4), baixar PDF e enviar pelo WhatsApp. */
export function OrderDocumentsMenu({
  orderId,
  code,
  customerName,
  whatsappNumber,
  message,
  baseUrl,
  baseUrlIsLocal,
  companyName,
}: {
  orderId: number;
  code: string;
  customerName: string;
  whatsappNumber: string | null;
  message: string;
  baseUrl: string;
  baseUrlIsLocal: boolean;
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  const target: ShareTarget = {
    type: 'ORDER',
    refId: orderId,
    code,
    customerName,
    whatsappNumber,
    message: message.replace(/\{\{link\}\}/g, '').replace(/[ \t]+\n/g, '\n').trim(),
    pdfHref: `/api/documentos/os/${orderId}/pdf?download=1`,
    baseUrl,
    baseUrlIsLocal,
  };

  return (
    <>
      <Menu
        label={`Documentos da ${code} (${companyName})`}
        trigger={
          <>
            <FileText aria-hidden="true" /> Documentos <ChevronDown aria-hidden="true" />
          </>
        }
      >
        <Link href={`/imprimir/os/${orderId}`} className="menu__item" role="menuitem">
          <Printer aria-hidden="true" /> Imprimir (folha A4)
        </Link>
        <a href={`/api/documentos/os/${orderId}/pdf?download=1`} className="menu__item" role="menuitem">
          <FileDown aria-hidden="true" /> Gerar / baixar PDF
        </a>
        <a href={`/api/documentos/os/${orderId}/pdf`} target="_blank" rel="noopener noreferrer" className="menu__item" role="menuitem">
          <FileText aria-hidden="true" /> Visualizar PDF
        </a>
        <div className="menu__separator" />
        <button type="button" className="menu__item" role="menuitem" onClick={() => setOpen(true)}>
          <WhatsAppIcon style={{ color: 'var(--green-700)' }} /> Enviar pelo WhatsApp
        </button>
      </Menu>
      <WhatsAppShareDialog target={target} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
