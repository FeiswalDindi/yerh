import { useSearchParams } from 'react-router-dom';

export function useCatalogueFilters() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const query = params.get('q') ?? '';
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  function matches(item: { title: string; category: string; summary: string }) {
    const text = `${item.title} ${item.category} ${item.summary}`.toLocaleLowerCase();
    return (!category || item.category === category) && terms.every((term) => text.includes(term));
  }

  return {
    params,
    category,
    matches,
    update,
    clear: () => setParams({}, { replace: true }),
    searchProps: { query, onChange: (q: string) => update({ q }) },
  };
}
