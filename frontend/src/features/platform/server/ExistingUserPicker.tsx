import { useEffect, useId, useState } from 'react';
import { errorText } from './WorkspaceActions';
type Choice = { id: number; name: string };
export function ExistingUserPicker({
  label,
  load,
  name = 'user_id',
  initial,
  multiple = false,
}: {
  label: string;
  name?: string;
  initial?: Choice;
  multiple?: boolean;
  load: (query: string, signal: AbortSignal) => Promise<Choice[]>;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ query: string; choices: Choice[]; error?: string }>();
  const [selected, setSelected] = useState<Choice[]>(initial ? [initial] : []);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const signal = new AbortController();
    const timer = window.setTimeout(() => {
      void load(query.trim(), signal.signal).then(
        (choices) => {
          if (!signal.signal.aborted) setResult({ query, choices });
        },
        (error) => {
          if (!signal.signal.aborted) setResult({ query, choices: [], error: errorText(error) });
        },
      );
    }, 250);
    return () => {
      window.clearTimeout(timer);
      signal.abort();
    };
  }, [query, load, retry]);
  const found = result?.query === query ? result : undefined;
  const choices = found?.choices ?? [];
  const options = [
    ...selected.filter((item) => !choices.some((c) => c.id === item.id)),
    ...choices,
  ];
  return (
    <div className="workspace-user-picker">
      <label htmlFor={id + '-search'}>
        Search accounts by name
        <input
          id={id + '-search'}
          type="search"
          maxLength={120}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label htmlFor={id + '-select'}>
        {label}
        <select
          id={id + '-select'}
          name={name}
          required
          multiple={multiple}
          size={multiple ? 6 : undefined}
          value={multiple ? selected.map((c) => String(c.id)) : (selected[0]?.id ?? '')}
          onChange={(e) => {
            const ids = new Set(Array.from(e.target.selectedOptions, (o) => Number(o.value)));
            setSelected(options.filter((c) => ids.has(c.id)));
          }}
        >
          {!multiple && <option value="">Choose an account</option>}
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} (#{item.id})
            </option>
          ))}
        </select>
      </label>
      <div aria-live="polite">
        {!found ? (
          'Searching eligible accounts…'
        ) : found.error ? (
          <>
            {found.error}{' '}
            <button
              type="button"
              onClick={() => {
                setResult(undefined);
                setRetry((n) => n + 1);
              }}
            >
              Retry search
            </button>
          </>
        ) : choices.length === 0 ? (
          'No eligible accounts found.'
        ) : null}
      </div>
    </div>
  );
}
