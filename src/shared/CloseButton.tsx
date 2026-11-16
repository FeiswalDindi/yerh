import type { ComponentPropsWithRef } from 'react';
import { X } from 'lucide-react';

type CloseButtonProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
  'aria-label': string;
  iconSize?: number;
};

export function CloseButton({
  className,
  iconSize = 22,
  type = 'button',
  ...props
}: CloseButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={className ? `close-button ${className}` : 'close-button'}
    >
      <X size={iconSize} aria-hidden="true" />
    </button>
  );
}
