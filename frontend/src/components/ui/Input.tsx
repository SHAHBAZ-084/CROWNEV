import { forwardRef, useState, type ChangeEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  passwordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, type, passwordToggle, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordField = type === 'password' && passwordToggle;
    const inputType = isPasswordField ? (showPassword ? 'text' : 'password') : type;

    const input = (
      <input
        ref={ref}
        id={id}
        type={inputType}
        className={`w-full rounded-xl border border-border-light bg-subtle px-4 py-2.5 text-sm text-ink placeholder:text-placeholder placeholder:opacity-100 outline-none transition-shadow focus:border-accent focus:ring-1 focus:ring-accent/20 ${isPasswordField ? 'pr-11' : ''} ${error ? 'border-warning shake' : ''} ${className}`}
        {...props}
      />
    );

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-ink-muted">
            {label}
          </label>
        )}
        {isPasswordField ? (
          <div className="relative">
            {input}
            <button
              type="button"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink-muted transition-colors hover:text-ink"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        ) : (
          input
        )}
        {error && <p className="text-xs text-warning">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export function Select({
  label,
  error,
  children,
  className = '',
  id,
  placeholder,
  defaultValue = '',
  value,
  onChange,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  placeholder?: string;
}) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = isControlled ? value : internalValue;
  const showPlaceholder = currentValue === '' || currentValue === undefined;

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e);
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-muted">
          {label}
        </label>
      )}
      <select
        id={id}
        {...props}
        value={currentValue}
        onChange={handleChange}
        className={`w-full rounded-xl border border-border-light bg-subtle px-4 py-2.5 text-sm outline-none transition-shadow focus:border-accent focus:ring-1 focus:ring-accent/20 ${showPlaceholder ? 'text-placeholder' : 'text-ink'} ${className}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
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
        <label htmlFor={id} className="block text-sm font-medium text-ink-muted">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`w-full rounded-xl border border-border-light bg-subtle px-4 py-2.5 text-sm text-ink placeholder:text-placeholder placeholder:opacity-100 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 resize-none ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-warning">{error}</p>}
    </div>
  );
}
