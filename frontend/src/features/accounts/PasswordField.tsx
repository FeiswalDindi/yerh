import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './password-field.css';

export function PasswordField({
  label = 'Password',
  name = 'password',
  autoComplete,
  className = '',
}: {
  label?: string;
  name?: string;
  autoComplete: 'new-password' | 'current-password';
  className?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  const action = `${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`;

  return (
    <div className={`password-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="password-field__control">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={autoComplete === 'new-password' ? 6 : undefined}
          maxLength={128}
          required
        />
        <button
          type="button"
          className="password-field__toggle"
          aria-label={action}
          aria-controls={id}
          title={action}
          onClick={() => setVisible((value) => !value)}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
