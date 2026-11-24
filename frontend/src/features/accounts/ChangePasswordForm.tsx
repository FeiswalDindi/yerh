import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Circle, KeyRound, ShieldCheck } from 'lucide-react';
import { localLaravelIdentity } from '../../services/laravel-identity-repository';
import { triggerCardErrorFeedback } from '../../shared/error-feedback';
import { CloseButton } from '../../shared/CloseButton';
import { PasswordField } from './PasswordField';

function passwordStrength(password: string): {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!password) return { level: 0, label: 'Not entered' };
  if (password.length < 6) return { level: 1, label: 'Too short' };
  let score = 1;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^\da-zA-Z]/.test(password)) score += 1;
  else if (/\d/.test(password) || /[^\da-zA-Z]/.test(password)) score += 1;

  const level = Math.min(4, Math.max(1, score)) as 1 | 2 | 3 | 4;
  const labels: Record<1 | 2 | 3 | 4, string> = {
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };
  return { level, label: labels[level] };
}

function PasswordUpdateFormFields({ onCancel }: { onCancel?: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  function shakeCard() {
    triggerCardErrorFeedback(
      formRef.current?.closest<HTMLElement>('.password-security-dialog, .profile-panel') ??
        formRef.current,
    );
  }

  const strength = passwordStrength(newPassword);
  const hasMinLength = newPassword.length >= 6;
  const differsFromCurrent =
    newPassword.length > 0 && currentPassword.length > 0 && newPassword !== currentPassword;
  const passwordsMatch = newPassword.length >= 6 && confirmPassword === newPassword;
  const hasMix = /[a-zA-Z]/.test(newPassword) && /[\d\W_]/.test(newPassword);
  const canSubmit = currentPassword.length > 0 && hasMinLength && passwordsMatch;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setError('Complete all password requirements before saving.');
      shakeCard();
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const message = await localLaravelIdentity.changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setNotice(message || 'Your password has been updated and other sessions were signed out.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your password.');
      shakeCard();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      className="workspace-form password-security-form"
      onSubmit={(e) => void submit(e)}
      onInvalidCapture={shakeCard}
    >
      <div className="password-security-banner">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>
          Changing your password updates your credentials immediately and signs out other active
          devices.
        </span>
      </div>

      <PasswordField
        label="Current password"
        name="current_password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={setCurrentPassword}
        placeholder="Enter your current password"
      />

      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
        placeholder="Minimum 6 characters"
      />

      <div className="password-strength" aria-live="polite">
        <div className="password-strength-header">
          <span>Password strength</span>
          <strong data-level={strength.level}>{strength.label}</strong>
        </div>
        <div className="password-strength-bars" data-level={strength.level} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <PasswordField
        label="Confirm new password"
        name="password_confirmation"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        placeholder="Re-enter your new password"
      />

      <ul className="password-checklist" aria-label="Password requirements">
        <li data-met={hasMinLength}>
          {hasMinLength ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Circle size={14} aria-hidden="true" />
          )}
          <span>At least 6 characters</span>
        </li>
        <li data-met={differsFromCurrent}>
          {differsFromCurrent ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Circle size={14} aria-hidden="true" />
          )}
          <span>Different from your current password</span>
        </li>
        <li data-met={passwordsMatch}>
          {passwordsMatch ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Circle size={14} aria-hidden="true" />
          )}
          <span>New passwords match</span>
        </li>
        <li data-met={hasMix}>
          {hasMix ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Circle size={14} aria-hidden="true" />
          )}
          <span>Mix of letters, numbers, or symbols (recommended)</span>
        </li>
      </ul>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="form-success">
          {notice}
        </p>
      )}

      <div className="workspace-form-footer">
        {onCancel && (
          <button type="button" className="button button-outline" onClick={onCancel}>
            {notice ? 'Done' : 'Cancel'}
          </button>
        )}
        <button className="button" type="submit" disabled={busy || !canSubmit}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}

export function ChangePasswordDialog() {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const node = dialogRef.current;
    if (open && node && !node.open) node.showModal();
  }, [open]);

  function closeDialog() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <>
      <div className="dashboard-password-card">
        <button
          type="button"
          className="button button-outline dashboard-password-trigger"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <KeyRound size={16} aria-hidden="true" />
          Update password
        </button>
      </div>

      {open && (
        <dialog
          ref={dialogRef}
          className="workspace-dialog password-security-dialog"
          aria-labelledby={titleId}
          onClose={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <header className="workspace-dialog-heading">
            <h2 id={titleId}>Password &amp; security</h2>
            <CloseButton
              aria-label="Close password & security modal"
              iconSize={19}
              onClick={closeDialog}
            />
          </header>
          <div className="workspace-dialog-body">
            <PasswordUpdateFormFields onCancel={closeDialog} />
          </div>
        </dialog>
      )}
    </>
  );
}

export function ChangePasswordForm() {
  return (
    <section
      className="profile-panel dashboard-profile-card"
      aria-labelledby="security-password-title"
    >
      <h2 id="security-password-title">Password &amp; security</h2>
      <PasswordUpdateFormFields />
    </section>
  );
}
