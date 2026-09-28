'use client';

import { useMemo, useState } from 'react';
import { saveGuaranteeTermsAction } from '@/actions/settings';
import { ActionForm } from '@/components/form/ActionForm';
import { Alert } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatMonthsInWords } from '@/lib/money-words';
import { parseTermsMarkup } from '@/lib/terms-markup';

/** Editor dos termos de garantia com pré-visualização ao vivo (mesma marcação usada nos documentos). */
export function TermsEditor({ initial }: { initial: { title: string; warrantyMonths: number; content: string } }) {
  const [title, setTitle] = useState(initial.title);
  const [months, setMonths] = useState(initial.warrantyMonths);
  const [content, setContent] = useState(initial.content);
  const blocks = useMemo(() => parseTermsMarkup(content, Math.max(1, months || 1)), [content, months]);

  return (
    <ActionForm action={saveGuaranteeTermsAction} className="stack">
      <Alert variant="warning" title="Conteúdo jurídico">
        Estes termos aparecem no final de todas as ordens de serviço. Altere apenas com orientação da empresa/advogado. Cada salvamento cria uma <strong>nova versão</strong>;
        documentos já entregues mantêm o texto da época.
      </Alert>
      <div className="form-grid">
        <div className="col-8 field">
          <label className="field__label" htmlFor="terms-title">
            Título do documento
          </label>
          <input id="terms-title" name="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
        </div>
        <div className="col-4 field">
          <label className="field__label" htmlFor="terms-months">
            Prazo de garantia (meses)
          </label>
          <input id="terms-months" name="warrantyMonths" type="number" min={1} max={60} className="input" value={months} onChange={(e) => setMonths(Number(e.target.value))} required />
          <p className="field__hint">
            Aparece como <strong>{formatMonthsInWords(Math.max(1, months || 1))}</strong> onde o texto tiver <code>{'{{prazo_garantia}}'}</code>.
          </p>
        </div>
      </div>

      <div className="terms-editor">
        <div className="field">
          <label className="field__label" htmlFor="terms-content">
            Texto dos termos
          </label>
          <textarea id="terms-content" name="content" className="textarea mono" rows={26} value={content} onChange={(e) => setContent(e.target.value)} required style={{ fontSize: 13, lineHeight: 1.5 }} />
          <p className="field__hint">
            Marcação: <code># Título da cláusula</code> · <code>## Subtítulo</code> · <code>- item de lista</code> · <code>!Linha em destaque</code> · linha em branco separa parágrafos.
          </p>
        </div>
        <div className="terms-preview" aria-label="Pré-visualização dos termos">
          <p className="terms-preview__label">Pré-visualização</p>
          <h3 className="terms-preview__title">{title}</h3>
          {blocks.map((block, index) => {
            switch (block.type) {
              case 'clause':
                return (
                  <p key={index} className="terms-preview__clause">
                    {block.text}
                  </p>
                );
              case 'subheading':
                return (
                  <p key={index} className="terms-preview__sub">
                    {block.text}
                  </p>
                );
              case 'paragraph':
                return <p key={index}>{block.text}</p>;
              case 'bullets':
                return (
                  <ul key={index}>
                    {block.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                );
              case 'highlight':
                return (
                  <p key={index} className="terms-preview__highlight">
                    {block.text}
                  </p>
                );
            }
          })}
        </div>
      </div>

      <div className="form-actions">
        <SubmitButton pendingLabel="Salvando…">Salvar nova versão dos termos</SubmitButton>
      </div>
    </ActionForm>
  );
}
