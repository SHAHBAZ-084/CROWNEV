import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SearchSelectOption {
  value: string;
  label: string;
}

interface SearchSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

function filterOptions(options: SearchSelectOption[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().includes(q));
}

export function SearchSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Search…',
  required,
  disabled,
}: SearchSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);
  const filtered = filterOptions(options, query);
  const displayValue = open ? query : (selected?.label ?? '');

  useEffect(() => {
    if (!open) {
      setQuery(selected?.label ?? '');
    }
  }, [open, selected?.label]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(option: SearchSelectOption) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          required={required && !value}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery(selected?.label ?? '');
          }}
          onChange={(e) => {
            if (disabled) return;
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onChange('');
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery(selected?.label ?? '');
            }
            if (e.key === 'Enter' && open && filtered.length > 0) {
              e.preventDefault();
              pick(filtered[0]);
            }
          }}
          className="w-full rounded-xl border border-border bg-surface-alt py-2.5 pl-4 pr-10 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surface-alt/50 disabled:opacity-60"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        {open && (
          <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-border bg-surface-alt py-1 shadow-lg">
            {filtered.length === 0 ? (
              <li className="px-4 py-2.5 text-sm text-text-muted">No matches</li>
            ) : (
              filtered.map((option) => (
                <li key={option.value || '__empty'}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(option)}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/10 ${
                      option.value === value ? 'bg-accent/5 font-medium text-brand' : 'text-text'
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
