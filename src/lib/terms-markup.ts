import { applyTemplate } from './text';
import { formatMonthsInWords } from './money-words';

/**
 * Marcação simples dos termos de garantia (editável em Configurações):
 *   # Título da cláusula        → cláusula
 *   ## Subtítulo                → subtítulo (ex.: Declaração do cliente)
 *   - item                      → lista
 *   !Texto                      → linha em destaque
 *   linha em branco             → separa parágrafos
 *   {{prazo_garantia}}          → "3 (três) meses" (conforme o prazo configurado)
 */
export type TermsBlock =
  | { type: 'clause'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'highlight'; text: string };

export function parseTermsMarkup(content: string, warrantyMonths: number): TermsBlock[] {
  const vars = { prazo_garantia: formatMonthsInWords(warrantyMonths) };
  const blocks: TermsBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: applyTemplate(paragraph.join(' '), vars) });
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length) blocks.push({ type: 'bullets', items: bullets.map((b) => applyTemplate(b, vars)) });
    bullets = [];
  };

  for (const rawLine of content.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushBullets();
    } else if (line.startsWith('## ')) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: 'subheading', text: applyTemplate(line.slice(3).trim(), vars) });
    } else if (line.startsWith('# ')) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: 'clause', text: applyTemplate(line.slice(2).trim(), vars) });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph();
      bullets.push(line.slice(2).trim());
    } else if (line.startsWith('!')) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: 'highlight', text: applyTemplate(line.slice(1).trim(), vars) });
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();
  return blocks;
}
