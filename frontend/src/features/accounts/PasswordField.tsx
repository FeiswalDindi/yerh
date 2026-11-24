import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './password-field.css';

export function PasswordField({
  label = 'Password',
  name = 'password',
  autoComplete,
  className = '',
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  name?: string;
  autoComplete: 'new-password' | 'current-password';
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
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
          {...(placeholder ? { placeholder } : {})}
          {...(value !== undefined ? { value } : {})}
          {...(onChange ? { onChange: (event) => onChange(event.target.value) } : {})}
        />
        <button
          type="button"
          className="password-field__toggle"
          aria-label={action}
          aria-controls={id}
          title={action}
          onClick={() => setVisible((prev) => !prev)}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
