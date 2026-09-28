/**
 * Mini biblioteca de layout sobre o PDFKit (A4, fontes Inter + Barlow Semi Condensed embutidas).
 * Cada documento (OS, recibo, venda, relatórios) monta seu conteúdo com estes blocos, para manter o mesmo visual.
 */
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { splitBrandName } from '@/lib/company';
import type { DocumentCompany, DocumentLogo } from '../model';

export const COLORS = {
  navy: '#0A2240',
  navy700: '#16407A',
  green: '#22B573',
  greenDark: '#0B7A44',
  text: '#0B1420',
  muted: '#4C5D75',
  subtle: '#6B7C93',
  border: '#DAE1EA',
  band: '#F1F5FA',
  white: '#FFFFFF',
  danger: '#B42318',
};

const FONT_DIR = path.join(process.cwd(), 'src', 'server', 'documents', 'fonts');

export type FontName = 'body' | 'medium' | 'semibold' | 'bold' | 'display' | 'displayBold';
const FONT_FILES: Record<FontName, string> = {
  body: 'inter-latin-400-normal.woff',
  medium: 'inter-latin-500-normal.woff',
  semibold: 'inter-latin-600-normal.woff',
  bold: 'inter-latin-700-normal.woff',
  display: 'barlow-semi-condensed-latin-600-normal.woff',
  displayBold: 'barlow-semi-condensed-latin-700-normal.woff',
};

export interface Column {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export class PdfWriter {
  readonly doc: InstanceType<typeof PDFDocument>;
  readonly margin = 42;
  readonly pageWidth = 595.28;
  readonly pageHeight = 841.89;
  readonly contentWidth = 595.28 - 84;
  private footerText: string;
  private readonly chunks: Buffer[] = [];

  constructor(info: { title: string; author: string; footerText: string }) {
    this.footerText = info.footerText;
    this.doc = new PDFDocument({
      size: 'A4',
      margins: { top: this.margin, bottom: 58, left: this.margin, right: this.margin },
      bufferPages: true,
      info: { Title: info.title, Author: info.author, Creator: info.author, Producer: info.author },
    });
    for (const [name, file] of Object.entries(FONT_FILES)) this.doc.registerFont(name, path.join(FONT_DIR, file));
    this.doc.on('data', (chunk: Buffer) => this.chunks.push(chunk));
  }

  get y(): number {
    return this.doc.y;
  }
  set y(value: number) {
    this.doc.y = value;
  }
  get bottomLimit(): number {
    return this.pageHeight - 58;
  }

  font(name: FontName, size: number, color = COLORS.text): this {
    this.doc.font(name).fontSize(size).fillColor(color);
    return this;
  }

  /** Garante espaço vertical; se não couber, começa uma nova página. */
  ensureSpace(height: number): void {
    if (this.y + height > this.bottomLimit) {
      this.doc.addPage();
      this.y = this.margin;
    }
  }

  /** Cabeçalho: logo (ou marca tipográfica provisória) à esquerda e dados da empresa à direita. */
  header(company: DocumentCompany, logo: DocumentLogo | null): void {
    const top = this.margin;
    const { doc } = this;
    const rightWidth = 240;
    const leftWidth = this.contentWidth - rightWidth - 16;
    let leftHeight = 0;

    if (logo) {
      try {
        doc.image(logo.data, this.margin, top, { fit: [Math.min(190, leftWidth), 54] });
        leftHeight = 54;
      } catch {
        /* logo inválida: cai para a marca tipográfica */
      }
    }
    if (!leftHeight) {
      const { accent, rest } = splitBrandName(company.name);
      let x = this.margin;
      if (accent) {
        doc.font('displayBold').fontSize(26).fillColor(COLORS.greenDark);
        doc.text(accent, x, top + 2, { lineBreak: false });
        x += doc.widthOfString(accent) + 7;
      }
      doc.font('displayBold').fontSize(accent ? 17 : 22).fillColor(COLORS.navy);
      doc.text(rest.toUpperCase(), x, top + (accent ? 9 : 4), { lineBreak: false, characterSpacing: 1.4 });
      leftHeight = 34;
    }

    // dados da empresa
    const x = this.pageWidth - this.margin - rightWidth;
    doc.font('bold').fontSize(10).fillColor(COLORS.navy).text(company.name, x, top, { width: rightWidth, align: 'right' });
    doc.font('body').fontSize(8).fillColor(COLORS.muted);
    const lines = [
      company.cnpj ? `CNPJ ${company.cnpj}` : '',
      [company.street, company.city].filter(Boolean).join(' - '),
      [company.phone, company.email].filter(Boolean).join('  ·  '),
    ].filter(Boolean);
    for (const line of lines) doc.text(line, x, doc.y + 1.5, { width: rightWidth, align: 'right' });

    const bottom = Math.max(top + leftHeight, doc.y) + 10;
    doc.save().rect(this.margin, bottom, this.contentWidth, 2).fill(COLORS.navy).rect(this.margin, bottom, 64, 2).fill(COLORS.green).restore();
    this.y = bottom + 14;
  }

  /** Faixa de título do documento com número (ou linha livre) e emissão. */
  titleBar(title: string, code: string | null, issuedOn: string, rightTop?: string): void {
    const { doc } = this;
    const y = this.y;
    doc.save().roundedRect(this.margin, y, this.contentWidth, 30, 4).fill(COLORS.navy).restore();
    doc.font('displayBold').fontSize(15).fillColor(COLORS.white).text(title, this.margin + 12, y + 8, { characterSpacing: 1.2, lineBreak: false });
    const top = rightTop ?? (code ? `Nº ${code}` : '');
    if (top) doc.font('semibold').fontSize(9).fillColor(COLORS.white).text(top, this.margin, y + 6, { width: this.contentWidth - 12, align: 'right', lineBreak: false });
    doc.font('body').fontSize(8).fillColor('#C5D8F2').text(`Emissão: ${issuedOn}`, this.margin, y + 18, { width: this.contentWidth - 12, align: 'right', lineBreak: false });
    this.y = y + 30 + 14;
  }

  /** Indicadores em caixas (até 4 por linha). */
  kpis(items: { label: string; value: string; hint?: string }[]): void {
    const { doc } = this;
    const perRow = 4;
    const gap = 8;
    const width = (this.contentWidth - gap * (perRow - 1)) / perRow;
    const height = 46;
    for (let start = 0; start < items.length; start += perRow) {
      this.ensureSpace(height + 8);
      const y = this.y;
      items.slice(start, start + perRow).forEach((item, i) => {
        const x = this.margin + i * (width + gap);
        doc.save().roundedRect(x, y, width, height, 4).lineWidth(0.7).stroke(COLORS.border).restore();
        doc.font('medium').fontSize(6.6).fillColor(COLORS.subtle).text(item.label.toUpperCase(), x + 8, y + 7, { width: width - 16, characterSpacing: 0.5, lineBreak: false });
        doc.font('displayBold').fontSize(13).fillColor(COLORS.navy).text(item.value, x + 8, y + 18, { width: width - 16, lineBreak: false, ellipsis: true });
        if (item.hint) doc.font('body').fontSize(6.8).fillColor(COLORS.muted).text(item.hint, x + 8, y + 35, { width: width - 16, lineBreak: false, ellipsis: true });
      });
      this.y = y + height + 8;
    }
  }

  sectionTitle(text: string): void {
    this.ensureSpace(40);
    const { doc } = this;
    const y = this.y;
    doc.save().rect(this.margin, y + 1, 3, 11).fill(COLORS.green).restore();
    doc.font('displayBold').fontSize(10.5).fillColor(COLORS.navy).text(text.toUpperCase(), this.margin + 9, y, { characterSpacing: 1.1, lineBreak: false });
    this.y = y + 18;
  }

  /** Pares rótulo/valor em N colunas. Retorna a altura utilizada. */
  keyValueGrid(pairs: { label: string; value: string; span?: number }[], columns = 2): void {
    const { doc } = this;
    const gap = 14;
    const colWidth = (this.contentWidth - gap * (columns - 1)) / columns;
    let col = 0;
    let rowTop = this.y;
    let rowHeight = 0;

    for (const pair of pairs) {
      const span = Math.min(pair.span ?? 1, columns);
      if (col + span > columns) {
        rowTop += rowHeight + 6;
        rowHeight = 0;
        col = 0;
      }
      const width = colWidth * span + gap * (span - 1);
      const x = this.margin + col * (colWidth + gap);
      const value = pair.value || '—';
      doc.font('medium').fontSize(7).fillColor(COLORS.subtle);
      const labelHeight = doc.heightOfString(pair.label.toUpperCase(), { width, characterSpacing: 0.6 });
      doc.font('body').fontSize(9.5);
      const valueHeight = doc.heightOfString(value, { width });
      if (rowTop + labelHeight + valueHeight > this.bottomLimit) {
        doc.addPage();
        rowTop = this.margin;
        rowHeight = 0;
      }
      doc.font('medium').fontSize(7).fillColor(COLORS.subtle).text(pair.label.toUpperCase(), x, rowTop, { width, characterSpacing: 0.6 });
      doc.font('body').fontSize(9.5).fillColor(COLORS.text).text(value, x, rowTop + labelHeight + 1.5, { width });
      rowHeight = Math.max(rowHeight, labelHeight + 1.5 + valueHeight);
      col += span;
      if (col >= columns) {
        rowTop += rowHeight + 6;
        rowHeight = 0;
        col = 0;
      }
    }
    this.y = rowTop + rowHeight + (rowHeight ? 6 : 0);
  }

  paragraph(text: string, opts: { font?: FontName; size?: number; color?: string; width?: number; x?: number; align?: 'left' | 'justify' | 'right' | 'center'; gap?: number } = {}): void {
    const { doc } = this;
    const width = opts.width ?? this.contentWidth;
    doc.font(opts.font ?? 'body').fontSize(opts.size ?? 9).fillColor(opts.color ?? COLORS.text);
    const height = doc.heightOfString(text, { width, align: opts.align ?? 'left', lineGap: 1.5 });
    this.ensureSpace(Math.min(height, 60));
    doc.text(text, opts.x ?? this.margin, this.y, { width, align: opts.align ?? 'left', lineGap: 1.5 });
    this.y = doc.y + (opts.gap ?? 5);
  }

  /** Tabela simples com cabeçalho repetido ao quebrar de página. */
  table(columns: Column[], rows: (string | { text: string; bold?: boolean; color?: string })[][], opts: { fontSize?: number } = {}): void {
    const { doc } = this;
    const size = opts.fontSize ?? 8.6;
    const padX = 6;
    const padY = 4.5;
    const total = columns.reduce((s, c) => s + c.width, 0);
    const scale = this.contentWidth / total;
    const widths = columns.map((c) => c.width * scale);

    const drawHeader = () => {
      const y = this.y;
      doc.save().rect(this.margin, y, this.contentWidth, 18).fill(COLORS.band).restore();
      let x = this.margin;
      columns.forEach((c, i) => {
        doc.font('semibold').fontSize(7).fillColor(COLORS.muted).text(c.header.toUpperCase(), x + padX, y + 6, { width: widths[i]! - padX * 2, align: c.align ?? 'left', characterSpacing: 0.5, lineBreak: false });
        x += widths[i]!;
      });
      doc.save().moveTo(this.margin, y + 18).lineTo(this.margin + this.contentWidth, y + 18).lineWidth(0.7).stroke(COLORS.border).restore();
      this.y = y + 18;
    };

    this.ensureSpace(40);
    drawHeader();
    for (const row of rows) {
      const cells = row.map((cell) => (typeof cell === 'string' ? { text: cell } : cell));
      doc.font('body').fontSize(size);
      const heights = cells.map((cell, i) => doc.heightOfString(cell.text || ' ', { width: widths[i]! - padX * 2 }));
      const rowHeight = Math.max(...heights) + padY * 2;
      if (this.y + rowHeight > this.bottomLimit) {
        doc.addPage();
        this.y = this.margin;
        drawHeader();
      }
      // `doc.y` avança a cada texto escrito; por isso a linha usa uma posição fixa (rowY).
      const rowY = this.y;
      let x = this.margin;
      cells.forEach((cell, i) => {
        doc.font(cell.bold ? 'semibold' : 'body').fontSize(size).fillColor(cell.color ?? COLORS.text);
        doc.text(cell.text, x + padX, rowY + padY, { width: widths[i]! - padX * 2, align: columns[i]!.align ?? 'left' });
        x += widths[i]!;
      });
      doc.save().moveTo(this.margin, rowY + rowHeight).lineTo(this.margin + this.contentWidth, rowY + rowHeight).lineWidth(0.4).stroke(COLORS.border).restore();
      this.y = rowY + rowHeight;
    }
    this.y += 8;
  }

  /** Bloco de totais alinhado à direita. */
  totals(lines: { label: string; value: string; strong?: boolean; color?: string }[], width = 230): void {
    const { doc } = this;
    const lineHeight = 15;
    const heightNeeded = lines.length * lineHeight + 14;
    this.ensureSpace(heightNeeded);
    const x = this.pageWidth - this.margin - width;
    let y = this.y;
    for (const line of lines) {
      if (line.strong) {
        doc.save().roundedRect(x - 6, y - 3, width + 6, lineHeight + 4, 3).fill(COLORS.band).restore();
      }
      doc.font(line.strong ? 'bold' : 'body').fontSize(line.strong ? 10.5 : 9).fillColor(line.strong ? COLORS.navy : COLORS.muted).text(line.label, x, y, { width: width * 0.55, lineBreak: false });
      doc.font(line.strong ? 'bold' : 'semibold').fontSize(line.strong ? 10.5 : 9).fillColor(line.color ?? (line.strong ? COLORS.greenDark : COLORS.text)).text(line.value, x + width * 0.45, y, { width: width * 0.55, align: 'right', lineBreak: false });
      y += lineHeight;
    }
    this.y = y + 6;
  }

  /** Duas linhas de assinatura lado a lado. */
  signatures(left: { label: string; name?: string }, right: { label: string; name?: string }): void {
    const { doc } = this;
    this.ensureSpace(80);
    const y = this.y + 34;
    const width = (this.contentWidth - 40) / 2;
    [left, right].forEach((sig, i) => {
      const x = this.margin + i * (width + 40);
      doc.save().moveTo(x, y).lineTo(x + width, y).lineWidth(0.8).stroke(COLORS.text).restore();
      doc.font('semibold').fontSize(8.5).fillColor(COLORS.text).text(sig.label, x, y + 5, { width, align: 'center', lineBreak: false });
      if (sig.name) doc.font('body').fontSize(8).fillColor(COLORS.muted).text(sig.name, x, y + 17, { width, align: 'center', lineBreak: false });
    });
    this.y = y + 34;
  }

  /** Rodapé em todas as páginas: dados da empresa e "Página X de Y". */
  private drawFooters(): void {
    const { doc } = this;
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const previousBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // permite escrever na área do rodapé sem gerar nova página
      const y = this.pageHeight - 40;
      doc.save().moveTo(this.margin, y - 6).lineTo(this.margin + this.contentWidth, y - 6).lineWidth(0.5).stroke(COLORS.border).restore();
      doc.font('body').fontSize(7.5).fillColor(COLORS.subtle).text(this.footerText, this.margin, y, { width: this.contentWidth - 80, align: 'left', lineBreak: false });
      doc.text(`Página ${i + 1} de ${range.count}`, this.margin, y, { width: this.contentWidth, align: 'right', lineBreak: false });
      doc.page.margins.bottom = previousBottom;
    }
  }

  async finish(): Promise<Buffer> {
    this.drawFooters();
    const done = new Promise<Buffer>((resolve, reject) => {
      this.doc.on('end', () => resolve(Buffer.concat(this.chunks)));
      this.doc.on('error', reject);
    });
    this.doc.end();
    return done;
  }
}
