import { Search } from 'lucide-react';

export function DashboardCatalogueSearch({
  label,
  query,
  onChange,
}: {
  label: string;
  query: string;
  onChange: (query: string) => void;
}) {
  return (
    <label className="dashboard-catalogue-search">
      <Search size={18} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
      />
    </label>
  );
}
