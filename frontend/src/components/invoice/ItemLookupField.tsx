import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { itemsApi } from '../../api/client';
import type { Item } from '../../types';

interface ItemLookupFieldProps {
  onSelect: (item: Item) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  autoFocus?: boolean;
}

export function ItemLookupField({ onSelect, placeholder = "Enter Item Code...", className = "", error, autoFocus }: ItemLookupFieldProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const handleLookup = async (value: string) => {
    const cleanVal = value.replace(/ITM-/i, '').trim();
    if (!cleanVal) return;
    const numericId = parseInt(cleanVal, 10);
    if (isNaN(numericId)) {
      setLookupError('Invalid Code format');
      return;
    }

    setLoading(true);
    setLookupError('');
    try {
      const item = await itemsApi.get(numericId);
      if (!item.isActive) {
        setLookupError('Item variant is inactive');
        return;
      }
      onSelect(item);
      setCode(''); // reset search
    } catch (err) {
      console.error(err);
      setLookupError('Item not found');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (code.trim()) {
        e.stopPropagation();
        handleLookup(code);
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={code}
          autoFocus={autoFocus}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => handleLookup(code)}
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-surface py-2 pl-3 pr-10 text-sm placeholder:text-ink-muted focus:border-orange-500 focus:outline-none ${
            error || lookupError ? 'border-red-500' : 'border-border-light'
          }`}
        />
        <button
          type="button"
          onClick={() => handleLookup(code)}
          disabled={loading || !code.trim()}
          className="absolute right-2 top-2 text-ink-muted hover:text-orange-500 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </button>
      </div>
      {(lookupError || error) && (
        <p className="mt-1 text-xs text-red-500">
          {lookupError || error}
        </p>
      )}
    </div>
  );
}
