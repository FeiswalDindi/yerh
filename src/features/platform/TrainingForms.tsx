import type { ReactNode } from 'react';
import type { TrainingCommand, CredentialKind, TrainingState } from '../../domain/incubation';
import {
  institutionForPath,
  schoolCertificateScore,
  schoolDivision,
  type IncubationCredential,
} from '../../domain/incubation';
import type { PlatformAction, PlatformState } from '../../domain/platform';
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

export function certificateDetails(p: PlatformState, record: IncubationCredential) {
  const path = p.incubations.find((row) => row.id === record.incubationId);
  const school = path && institutionForPath(p, path)?.kind === 'high-school';
  if (school) {
    const score = record.schoolScore ?? schoolCertificateScore(p.training, record);
    return { division: score === undefined ? undefined : schoolDivision(score), achievements: [] };
  }
  const stage = p.training.curriculum.find((row) => row.id === record.kind);
  return {
    division: undefined,
    achievements: stage
      ? [...stage.steps.map((step) => step.title), `${stage.title} assessment completed`]
      : p.training.curriculum.map((row) => `${row.title} assessment completed`),
  };
}
