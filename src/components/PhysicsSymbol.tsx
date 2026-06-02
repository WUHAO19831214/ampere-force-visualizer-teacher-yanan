const subscriptDigits: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
};

interface PhysicsSymbolProps {
  symbol: string;
  className?: string;
}

export function PhysicsSymbol({ symbol, className }: PhysicsSymbolProps) {
  const parts = symbol.split(/(\d+)/).filter(Boolean);
  return (
    <span className={['physics-symbol', className].filter(Boolean).join(' ')}>
      {parts.map((part, index) =>
        /^\d+$/.test(part) ? <sub key={`${part}-${index}`}>{part}</sub> : <span key={`${part}-${index}`}>{part}</span>,
      )}
    </span>
  );
}

export function toUnicodePhysicsSymbol(symbol: string) {
  return symbol.replace(/\d/g, (digit) => subscriptDigits[digit] ?? digit);
}
