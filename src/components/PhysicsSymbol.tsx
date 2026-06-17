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
  const forceComponentMatch = symbol.match(/^F([xyz])$/i);
  if (forceComponentMatch) {
    return (
      <span className={['physics-symbol', className].filter(Boolean).join(' ')}>
        <span>F</span>
        <sub>{forceComponentMatch[1].toLowerCase()}</sub>
      </span>
    );
  }

  if (symbol === 'F磁场力' || symbol === 'F安培力') {
    return (
      <span className={['physics-symbol', className].filter(Boolean).join(' ')}>
        <span>F</span>
        <sub>安培力</sub>
      </span>
    );
  }

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
  if (/^Fx$/i.test(symbol)) return 'Fₓ';
  if (/^Fy$/i.test(symbol)) return 'Fᵧ';
  if (/^Fz$/i.test(symbol)) return 'Fᶻ';
  if (symbol === 'F磁场力' || symbol === 'F安培力') return 'F_安培力';
  return symbol.replace(/\d/g, (digit) => subscriptDigits[digit] ?? digit);
}
