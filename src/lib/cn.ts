/** Junta nomes de classe ignorando valores falsos. */
export function cn(...parts: (string | false | null | undefined | 0)[]): string {
  return parts.filter(Boolean).join(' ');
}
