/**
 * Converte o texto simples de uma política (escrito no sistema) em blocos para exibir no site.
 * Nada de HTML livre: o texto vira só parágrafos, subtítulos e listas — quem escreve não consegue injetar código.
 *
 * Regras (para quem edita o texto):
 * - linha em branco separa parágrafos;
 * - "1. Título" curto, sem ponto final, vira subtítulo;
 * - linhas começando com "- " viram itens de lista.
 */
export type PolicyBlock = { type: 'heading'; text: string } | { type: 'paragraph'; text: string } | { type: 'list'; items: string[] };

const HEADING_RE = /^\d{1,2}[.)]\s+\S.{0,78}$/;
const BULLET_RE = /^[-•]\s+(\S.*)$/;

export function parsePolicyText(text: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length > 0) blocks.push({ type: 'list', items: list });
    list = [];
  };

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]!.trim());
      continue;
    }
    if (HEADING_RE.test(line) && !/[.;:,]$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', text: line });
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Tamanho máximo do texto da política de privacidade (caracteres). */
export const PRIVACY_TEXT_MAX = 12_000;
