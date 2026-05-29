const DECIMAL_NUMBER = /[+-]?(?:(?:\d+\.\d*)|(?:\d*\.\d+)|(?:\d+))/g;

export function normalizeOcrText(text: string): string {
  return text
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/[，]/g, '.')
    .replace(/\s+/g, '')
    .replace(/[^0-9+\-.]/g, '');
}

export function extractNumberFromText(text: string): number | null {
  const normalized = normalizeOcrText(text);
  const matches = normalized.match(DECIMAL_NUMBER);
  if (!matches?.length) return null;

  const candidates = matches
    .map((candidate) => ({ text: candidate, value: Number(candidate) }))
    .filter((candidate) => Number.isFinite(candidate.value))
    .sort((left, right) => {
      const leftHasDecimal = left.text.includes('.') ? 1 : 0;
      const rightHasDecimal = right.text.includes('.') ? 1 : 0;
      const leftLength = left.text.replace(/[+-.]/g, '').length;
      const rightLength = right.text.replace(/[+-.]/g, '').length;
      return rightHasDecimal - leftHasDecimal || rightLength - leftLength;
    });
  const value = candidates[0]?.value;
  return Number.isFinite(value) ? value : null;
}
