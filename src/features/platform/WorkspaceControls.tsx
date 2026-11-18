import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { CloseButton } from '../../shared/CloseButton';
import { useDemo } from '../../app/useDemo';
import './workspace.css';

export function WorkspaceDialog({
  action,
  title = action,
  create = false,
  children,
}: {
  action: string;
  title?: string;
  create?: boolean;
  children: (finish: (saved: boolean) => void) => ReactNode;
}) {
  const label = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const { error } = useDemo();

  useLayoutEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
  }, [open]);

  function close() {
    ref.current?.close();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={`button workspace-action${create ? '' : ' button-outline'}`}
        aria-haspopup="dialog"
        aria-label={title === action ? undefined : `${action}: ${title}`}
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
      >
        {create && <Plus size={16} aria-hidden="true" />}
        {action}
      </button>
      {open && (
        <dialog
          ref={ref}
          className="workspace-dialog"
          aria-labelledby={label}
          onClose={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <header className="workspace-dialog-heading">
            <h2 id={label}>{title}</h2>
            <CloseButton aria-label="Close dialog" iconSize={19} onClick={close} />
          </header>
          <div className="workspace-dialog-body">
            {failed && (
              <p role="alert" className="workspace-dialog-error">
                {error || 'The changes could not be saved.'}
              </p>
            )}
            {children((saved) => {
              if (saved) close();
              else setFailed(true);
            })}
          </div>
        </dialog>
      )}
    </>
  );
}

export function WorkspaceTabs({
  label,
  views,
}: {
  label: string;
  views: { id: string; label: string; count?: number; content: ReactNode }[];
}) {
  const [params] = useSearchParams();
  const active = views.find((view) => view.id === params.get('view')) ?? views[0];
  if (!active) return null;
  return (
    <>
      <nav className="workspace-tabs" aria-label={label}>
        {views.map((view) => {
          const next = new URLSearchParams(params);
          next.set('view', view.id);
          return (
            <Link
              key={view.id}
              to={`?${next}`}
              aria-current={view.id === active.id ? 'page' : undefined}
              preventScrollReset
            >
              {view.label}
              {view.count !== undefined && (
                <span className="workspace-tab-count">{view.count}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="workspace-view" key={active.id}>
        {active.content}
      </div>
    </>
  );
}

export function WorkspaceFormDialog({
  onSave,
  submit,
  children,
  ...dialog
}: {
  action: string;
  title?: string;
  create?: boolean;
  submit: string;
  onSave: (data: FormData) => boolean;
  children: ReactNode;
}) {
  return (
    <WorkspaceDialog {...dialog}>
      {(finish) => (
        <form
          className="workspace-form"
          onSubmit={(event) => {
            event.preventDefault();
            finish(onSave(new FormData(event.currentTarget)));
          }}
        >
          {children}
          <div className="workspace-form-footer">
            <button className="button">{submit}</button>
          </div>
        </form>
      )}
    </WorkspaceDialog>
  );
}

export function WorkspaceTable({
  label,
  columns,
  rows,
  actions,
  empty = 'There are no records yet.',
}: {
  label: string;
  columns: string[];
  rows: { id: string; search: string; cells: ReactNode[] }[];
  actions?: ReactNode;
  empty?: ReactNode;
}) {
  const [search, setSearch] = useState('');
  const filters = search.trim().toLocaleLowerCase().split(/\s+/);
  const matches = rows.filter((row) =>
    filters.every((word) => row.search.toLocaleLowerCase().includes(word)),
  );
  return (
    <div className="workspace-data">
      <div className="workspace-data-toolbar">
        <label className="workspace-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            aria-label={`Search ${label}`}
            placeholder={`Search ${label}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {actions && <div className="workspace-toolbar-actions">{actions}</div>}
      </div>
      <div
        className="workspace-data-scroll"
        role="region"
        aria-label={`${label} table`}
        tabIndex={0}
      >
        <table aria-label={label} className="workspace-data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matches.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, i) =>
                  i === 0 ? (
                    <th scope="row" key={i}>
                      {cell}
                    </th>
                  ) : (
                    <td key={i}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
            {!matches.length && (
              <tr>
                <td className="workspace-empty" colSpan={columns.length}>
                  {rows.length ? 'No records match your search.' : empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="workspace-data-count" aria-live="polite">
        {matches.length} of {rows.length} {rows.length === 1 ? 'record' : 'records'}
      </p>
    </div>
  );
}

export function WorkspaceStatus({ children }: { children: string }) {
  return (
    <span className="workspace-status" data-status={children.toLowerCase()}>
      {children.replaceAll('-', ' ')}
    </span>
  );
}
