import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  /** Allow typing a value that is not in the options list */
  allowCustom?: boolean;
  autoFocus?: boolean;
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
  allowCustom = false,
  autoFocus,
}: SearchSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);
  const filtered = filterOptions(options, query);
  const trimmedQuery = query.trim();
  const displayValue = open ? query : (allowCustom ? value : (selected?.label ?? ''));

  useEffect(() => {
    if (!open) {
      setQuery(allowCustom ? value : (selected?.label ?? ''));
    }
  }, [open, selected?.label, allowCustom, value]);

  const commitValue = useCallback(
    (nextQuery: string) => {
      const trimmed = nextQuery.trim();
      if (allowCustom) {
        if (trimmed !== value) onChange(trimmed);
        setQuery(trimmed);
        return;
      }
      const match = options.find((o) => o.label.toLowerCase() === trimmed.toLowerCase());
      if (match) {
        if (match.value !== value) onChange(match.value);
        setQuery(match.label);
      } else {
        setQuery(selected?.label ?? '');
      }
    },
    [allowCustom, onChange, options, selected?.label, value],
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        commitValue(query);
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [query, commitValue]);

  function pick(option: SearchSelectOption) {
    if (option.value !== value) onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  const fieldClass =
    'w-full rounded-xl border border-border-light bg-subtle py-2.5 pl-4 pr-10 text-sm text-ink placeholder:text-placeholder placeholder:opacity-100 outline-none transition-shadow focus:border-accent focus:ring-1 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-subtle/50 disabled:opacity-60';

  return (
    <div ref={rootRef} className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-muted">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          disabled={disabled}
          autoFocus={autoFocus}
          value={displayValue}
          placeholder={placeholder}
          required={required && !value.trim()}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery(allowCustom ? value : (selected?.label ?? ''));
          }}
          onBlur={() => {
            if (disabled) return;
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                commitValue(query);
                setOpen(false);
              }
            }, 0);
          }}
          onChange={(e) => {
            if (disabled) return;
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            if (allowCustom) {
              onChange(next);
            } else if (!next.trim()) {
              onChange('');
            }
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery(allowCustom ? value : (selected?.label ?? ''));
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (open) {
                e.stopPropagation();
                if (filtered.length > 0) {
                  pick(filtered[0]);
                  return;
                }
                if (allowCustom && trimmedQuery) {
                  onChange(trimmedQuery);
                  setQuery(trimmedQuery);
                  setOpen(false);
                }
              }
            }
          }}
          className={fieldClass}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
        {open && (
          <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-border-light bg-elevated py-1 shadow-lg">
            {filtered.length === 0 ? (
              allowCustom && trimmedQuery ? (
                <li>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick({ value: trimmedQuery, label: trimmedQuery })}
                    className="w-full px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-subtle"
                  >
                    Use &ldquo;{trimmedQuery}&rdquo;
                  </button>
                </li>
              ) : (
                <li className="px-4 py-2.5 text-sm text-ink-muted">No matches</li>
              )
            ) : (
              filtered.map((option) => (
                <li key={option.value || '__empty'}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(option)}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-subtle ${
                      option.value === value ? 'bg-subtle font-medium text-ink' : 'text-ink'
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
