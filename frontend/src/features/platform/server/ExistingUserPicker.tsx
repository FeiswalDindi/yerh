import { useEffect, useId, useState } from 'react';
import { Check, X } from 'lucide-react';
import { errorText } from './WorkspaceActions';

type Choice = { id: number; name: string };

export function ExistingUserPicker({
  label,
  load,
  name = 'user_id',
  initial,
  multiple = false,
  hint,
}: {
  label: string;
  name?: string;
  initial?: Choice;
  multiple?: boolean;
  hint?: string;
  load: (query: string, signal: AbortSignal) => Promise<Choice[]>;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ query: string; choices: Choice[]; error?: string }>();
  const [selected, setSelected] = useState<Choice[]>(initial ? [initial] : []);
  const [retry, setRetry] = useState(0);
  const trimmed = query.trim();

  useEffect(() => {
    const signal = new AbortController();
    const timer = window.setTimeout(() => {
      void load(trimmed, signal.signal).then(
        (choices) => {
          if (!signal.signal.aborted) setResult({ query: trimmed, choices });
        },
        (error) => {
          if (!signal.signal.aborted)
            setResult({ query: trimmed, choices: [], error: errorText(error) });
        },
      );
    }, 180);
    return () => {
      window.clearTimeout(timer);
      signal.abort();
    };
  }, [trimmed, load, retry]);

  const found = result?.query === trimmed ? result : undefined;
  const choices = found?.choices ?? [];

  function toggleChoice(item: Choice) {
    setSelected((current) => {
      const exists = current.some((entry) => entry.id === item.id);
      if (multiple) {
        return exists ? current.filter((entry) => entry.id !== item.id) : [...current, item];
      }
      return exists ? [] : [item];
    });
  }

  return (
    <div className="workspace-user-picker">
      {selected.map((item) => (
        <input key={item.id} type="hidden" name={name} value={String(item.id)} />
      ))}

      <label htmlFor={id + '-search'}>
        Search accounts by name or email
        <div className="workspace-picker-search-wrap">
          <input
            id={id + '-search'}
            type="search"
            maxLength={120}
            value={query}
            placeholder="Type a name or email to filter…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
          />
          {query && (
            <button
              type="button"
              className="workspace-picker-clear"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </label>

      {selected.length > 0 && (
        <div className="workspace-picker-selected" aria-label="Selected accounts">
          {selected.map((item) => (
            <span key={item.id} className="workspace-picker-chip">
              <span>
                {item.name} (#{item.id})
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => toggleChoice(item)}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div>
        <p id={id + '-list-label'} className="workspace-picker-field-label">
          {label}
        </p>
        <div
          className="workspace-picker-list"
          role="listbox"
          aria-labelledby={id + '-list-label'}
          aria-multiselectable={multiple || undefined}
        >
          {choices.map((item) => {
            const isSelected = selected.some((entry) => entry.id === item.id);
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className="workspace-picker-option"
                onClick={() => toggleChoice(item)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>Account #{item.id}</small>
                </span>
                {isSelected && <Check size={16} aria-hidden="true" />}
              </button>
            );
          })}
          {!found ? (
            <p className="workspace-picker-empty">Searching eligible accounts…</p>
          ) : choices.length === 0 && !found.error ? (
            <p className="workspace-picker-empty">
              {trimmed ? `No eligible accounts match "${trimmed}".` : 'No eligible accounts found.'}
            </p>
          ) : null}
        </div>
      </div>

      <div className="workspace-picker-status" aria-live="polite">
        {!found ? (
          'Searching database…'
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
        ) : (
          <>
            {choices.length} eligible {choices.length === 1 ? 'account' : 'accounts'} found
            {trimmed ? ` for "${trimmed}"` : ''}
          </>
        )}
      </div>

      {hint && <small className="workspace-picker-hint">{hint}</small>}
    </div>
  );
}
