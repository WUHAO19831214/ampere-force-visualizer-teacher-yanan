interface CsvExportButtonProps {
  label: string;
  onExport: () => void;
  disabled?: boolean;
}

export function CsvExportButton({ label, onExport, disabled }: CsvExportButtonProps) {
  return (
    <button className="secondary-button" onClick={onExport} disabled={disabled}>
      {label}
    </button>
  );
}
