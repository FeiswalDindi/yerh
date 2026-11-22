import type { ReactNode } from 'react';

export const now = () => new Date().toISOString();
export function Field({
  label,
  name,
  type = 'text',
  required = true,
  minLength = 2,
  defaultValue = '',
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      {type === 'textarea' ? (
        <textarea
          name={name}
          required={required}
          minLength={minLength}
          maxLength={3000}
          defaultValue={defaultValue}
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          minLength={type === 'text' ? minLength : undefined}
          defaultValue={defaultValue}
        />
      )}
    </label>
  );
}
export function Panel({
  title,
  children,
  showTitle = false,
}: {
  title: string;
  children: ReactNode;
  showTitle?: boolean;
}) {
  return (
    <section className="workspace-panel">
      <h2 className={showTitle ? undefined : 'workspace-panel-title'}>{title}</h2>
      {children}
    </section>
  );
}
