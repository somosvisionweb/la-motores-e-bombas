import type { DocumentCompany } from '@/server/documents/model';
import { BrandMark } from '@/components/system/BrandMark';

/** Cabeçalho do documento: logo (ou marca tipográfica) + dados da empresa vindos das configurações. */
export function SheetHeader({ company }: { company: DocumentCompany }) {
  return (
    <header className="sheet__header">
      <div>
        <BrandMark name={company.name} logoFileId={company.logoFileId} surface="light" fontSize={20} logoHeight={56} />
      </div>
      <div className="sheet__company">
        <strong>{company.name}</strong>
        {company.cnpj ? <div>CNPJ {company.cnpj}</div> : null}
        <div>{[company.street, company.city].filter(Boolean).join(' - ')}</div>
        <div>{[company.phone, company.email].filter(Boolean).join('  ·  ')}</div>
      </div>
    </header>
  );
}

export function SheetTitle({ title, code, issuedOn }: { title: string; code: string; issuedOn: string }) {
  return (
    <div className="sheet__title">
      <h1>{title}</h1>
      <div>
        <strong>Nº {code}</strong>
        <small>Emissão: {issuedOn}</small>
      </div>
    </div>
  );
}

export function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sheet__section">
      <h2 className="sheet__section-title">{title}</h2>
      {children}
    </section>
  );
}

export function Field({ label, value, span = 1 }: { label: string; value: React.ReactNode; span?: 1 | 2 | 3 | 4 }) {
  return (
    <div className={span > 1 ? `sheet__field sheet__field--${span}` : 'sheet__field'}>
      <span className="sheet__label">{label}</span>
      <span className="sheet__value">{value || '—'}</span>
    </div>
  );
}

export function SheetFooter({ company, page, pages }: { company: DocumentCompany; page: number; pages: number }) {
  return (
    <footer className="sheet__footer">
      <span>{[company.name, company.cnpj ? `CNPJ ${company.cnpj}` : '', [company.street, company.city].filter(Boolean).join(' - ')].filter(Boolean).join('  ·  ')}</span>
      <span>
        Página {page} de {pages}
      </span>
    </footer>
  );
}
