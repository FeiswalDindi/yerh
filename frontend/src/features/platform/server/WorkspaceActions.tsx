import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { LoadingDots } from '../../../shared/SiteLoader';
import { WorkspaceDialog } from '../workspace/WorkspaceControls';

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Could not complete this request.';
}

export function useWorkspaceRecords<T>(load: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [records, setRecords] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const onReturn = () => {
      if (document.visibilityState === 'visible') setVersion((v) => v + 1);
    };
    document.addEventListener('visibilitychange', onReturn);
    return () => document.removeEventListener('visibilitychange', onReturn);
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const request = new AbortController();
    setError('');
    void load(request.signal)
      .then((data) => {
        if (!request.signal.aborted) setRecords(data);
      })
      .catch((error: unknown) => {
        if (!request.signal.aborted) setError(errorText(error));
      });
    return () => request.abort();
  }, [load, version, enabled]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { records, error, reload };
}

export function RecordsFeedback({ error, loading }: { error: string; loading: boolean }) {
  if (error)
    return (
      <p role="alert" className="form-error">
        {error}
      </p>
    );
  if (loading)
    return (
      <p role="status" className="yerh-status-loading">
        <LoadingDots label="Loading" />
      </p>
    );
  return null;
}

export function WorkspaceAction({
  action,
  title,
  save,
  children,
  create,
  initialOpen,
  submit = 'Save',
}: {
  action: string;
  title?: string;
  save: (data: FormData) => Promise<void>;
  children: ReactNode;
  create?: boolean;
  initialOpen?: boolean;
  submit?: string;
}) {
  return (
    <WorkspaceDialog action={action} title={title} create={create} initialOpen={initialOpen}>
      {(finish) => (
        <ActionForm save={save} finish={() => finish(true)} submit={submit}>
          {children}
        </ActionForm>
      )}
    </WorkspaceDialog>
  );
}

function ActionForm({
  save,
  finish,
  submit,
  children,
}: {
  save: (data: FormData) => Promise<void>;
  finish: () => void;
  submit: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await save(data);
      window.dispatchEvent(new Event('yerh:workspace-updated'));
      finish();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="workspace-form" onSubmit={(event) => void handleSubmit(event)}>
      {children}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="workspace-form-footer">
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : submit}
        </button>
      </div>
    </form>
  );
}

export const fieldValue = (data: FormData, field: string) => String(data.get(field) ?? '').trim();

export function DecisionAction({
  name,
  decide,
}: {
  name: string;
  decide: (decision: string, note: string) => Promise<void>;
}) {
  const [decision, setDecision] = useState('approved');
  return (
    <WorkspaceAction
      action="Review record"
      title={name}
      submit="Save decision"
      save={(data) => decide(fieldValue(data, 'decision'), fieldValue(data, 'note'))}
    >
      <label>
        Decision
        <select
          name="decision"
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
        >
          <option value="approved">Approve</option>
          <option value="rejected">Reject</option>
        </select>
      </label>
      <label>
        {decision === 'rejected' ? 'Reason for rejection' : 'Note (optional)'}
        <textarea name="note" required={decision === 'rejected'} maxLength={1500} />
      </label>
    </WorkspaceAction>
  );
}
