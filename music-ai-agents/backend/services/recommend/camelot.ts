export function parseCamelot(code: string): { number: number; letter: 'A' | 'B' } | null {
  const match = code.trim().toUpperCase().match(/^(\d{1,2})([AB])$/);
  if (!match) return null;
  return { number: Number(match[1]), letter: match[2] as 'A' | 'B' };
}

/** Compatible if identical, same number (relative major/minor) or adjacent number on the wheel with same letter. */
export function areCamelotCompatible(a: string, b: string): boolean {
  const ca = parseCamelot(a);
  const cb = parseCamelot(b);
  if (!ca || !cb) return false;
  if (ca.number === cb.number) return true;
  if (ca.letter === cb.letter) {
    const diff = Math.abs(ca.number - cb.number);
    return diff === 1 || diff === 11;
  }
  return false;
}

export function compatibleCamelotCodes(code: string): string[] {
  const parsed = parseCamelot(code);
  if (!parsed) return [];
  const wrap = (n: number) => ((n - 1 + 12) % 12) + 1;
  return [
    code,
    `${parsed.number}${parsed.letter === 'A' ? 'B' : 'A'}`,
    `${wrap(parsed.number + 1)}${parsed.letter}`,
    `${wrap(parsed.number - 1)}${parsed.letter}`,
  ];
}
