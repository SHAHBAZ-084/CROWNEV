import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20 ${error ? 'border-warning shake' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-warning">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

export function Select({
  label,
  error,
  children,
  className = '',
  id,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-warning">{error}</p>}
    </div>
  );
}

export function Textarea({
  label,
  error,
  className = '',
  id,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-warning">{error}</p>}
    </div>
  );
}
