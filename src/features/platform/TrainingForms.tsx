import type { ReactNode } from 'react';
import type { TrainingCommand, CredentialKind, TrainingState } from '../../domain/incubation';
import type { PlatformAction } from '../../domain/platform';
import { WorkspaceFormDialog } from './WorkspaceControls';

export type Save = (action: PlatformAction) => boolean;

export function submitTraining(save: Save, action: TrainingCommand) {
  return save({ ...action, now: new Date().toISOString() });
}

export function TrainingForm({
  save,
  build,
  label,
  children,
  reset = false,
  dialog,
}: {
  save: Save;
  build: (data: FormData) => TrainingCommand;
  label: string;
  children: ReactNode;
  reset?: boolean;
  dialog?: { action: string; title?: string; create?: boolean; icon?: ReactNode };
}) {
  if (dialog)
    return (
      <WorkspaceFormDialog
        {...dialog}
        submit={label}
        onSave={(data) => submitTraining(save, build(data))}
      >
        {children}
      </WorkspaceFormDialog>
    );

  return (
    <form
      className="workspace-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (submitTraining(save, build(new FormData(form))) && reset) form.reset();
      }}
    >
      {children}
      <button className="button button-outline">{label}</button>
    </form>
  );
}

export const field = (data: FormData, key: string) => String(data.get(key) ?? '');
export const amount = (value: number) => `KES ${value.toLocaleString('en-KE')}`;

export function credentialTitle(training: TrainingState, kind: CredentialKind) {
  if (kind === 'venture') return 'Venture incubation certificate';
  return `${training.curriculum.find((stage) => stage.id === kind)?.title} certificate`;
}
