import { useRef } from 'react';
import { ImagePlus, Star, X } from 'lucide-react';

export type PendingImage = {
  id: string;
  file: File;
  preview: string;
};

export type ExistingImage = {
  id: number;
  url: string;
  isPrimary?: boolean;
};

export type PrimarySelection =
  | { type: 'existing'; id: number }
  | { type: 'pending'; id: string };

export function imageKey(sel: PrimarySelection) {
  return `${sel.type}-${sel.id}`;
}

export function primaryFromImages(
  existing: ExistingImage[],
  pending: PendingImage[]
): PrimarySelection | null {
  const primaryExisting = existing.find((i) => i.isPrimary);
  if (primaryExisting) return { type: 'existing', id: primaryExisting.id };
  if (pending.length) return { type: 'pending', id: pending[0].id };
  if (existing.length) return { type: 'existing', id: existing[0].id };
  return null;
}

export function ProductImageUpload({
  pending,
  existing = [],
  primary,
  onPendingChange,
  onPrimaryChange,
  onRemoveExisting,
  max = 8,
}: {
  pending: PendingImage[];
  existing?: ExistingImage[];
  primary: PrimarySelection | null;
  onPendingChange: (images: PendingImage[]) => void;
  onPrimaryChange: (selection: PrimarySelection | null) => void;
  onRemoveExisting?: (id: number) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const total = existing.length + pending.length;
  const canAdd = total < max;
  const primaryKey = primary ? imageKey(primary) : null;

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const remaining = max - total;
    const picked = Array.from(files).slice(0, remaining);
    const next = [
      ...pending,
      ...picked.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    ];
    onPendingChange(next);
    if (!primary && next.length) onPrimaryChange({ type: 'pending', id: next[0].id });
    if (inputRef.current) inputRef.current.value = '';
  }

  function removePending(id: string) {
    const item = pending.find((p) => p.id === id);
    if (item) URL.revokeObjectURL(item.preview);
    const next = pending.filter((p) => p.id !== id);
    onPendingChange(next);
    if (primary?.type === 'pending' && primary.id === id) {
      onPrimaryChange(primaryFromImages(existing, next));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-text">Bike Images</label>
        <span className="text-xs text-text-muted">{total}/{max} images</span>
      </div>
      <p className="text-xs text-text-muted">Click the star on any image to set it as the primary shop thumbnail.</p>

      {(existing.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {existing.map((img) => {
            const key = imageKey({ type: 'existing', id: img.id });
            const isPrimary = primaryKey === key;
            return (
              <div
                key={`existing-${img.id}`}
                className={`relative aspect-square overflow-hidden rounded-xl border bg-surface-alt ${isPrimary ? 'border-accent ring-2 ring-accent/30' : 'border-border'}`}
              >
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
                  <button
                    type="button"
                    onClick={() => onPrimaryChange({ type: 'existing', id: img.id })}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      isPrimary ? 'bg-accent text-white' : 'bg-white/90 text-text hover:bg-accent hover:text-white'
                    }`}
                    title="Set as primary"
                  >
                    <Star className={`h-3 w-3 ${isPrimary ? 'fill-current' : ''}`} />
                    {isPrimary ? 'Primary' : 'Set primary'}
                  </button>
                  {onRemoveExisting && (
                    <button
                      type="button"
                      onClick={() => onRemoveExisting(img.id)}
                      className="rounded-full bg-white/90 p-1 text-text-muted shadow hover:text-warning"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {pending.map((img) => {
            const key = imageKey({ type: 'pending', id: img.id });
            const isPrimary = primaryKey === key;
            return (
              <div
                key={img.id}
                className={`relative aspect-square overflow-hidden rounded-xl border bg-surface-alt ${isPrimary ? 'border-accent ring-2 ring-accent/30' : 'border-border'}`}
              >
                <img src={img.preview} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
                  <button
                    type="button"
                    onClick={() => onPrimaryChange({ type: 'pending', id: img.id })}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      isPrimary ? 'bg-accent text-white' : 'bg-white/90 text-text hover:bg-accent hover:text-white'
                    }`}
                    title="Set as primary"
                  >
                    <Star className={`h-3 w-3 ${isPrimary ? 'fill-current' : ''}`} />
                    {isPrimary ? 'Primary' : 'Set primary'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removePending(img.id)}
                    className="rounded-full bg-white/90 p-1 text-text-muted shadow hover:text-warning"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canAdd && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-alt px-4 py-6 text-sm text-text-muted transition-colors hover:border-accent hover:bg-accent/5"
        >
          <ImagePlus className="h-7 w-7 text-brand-light" />
          <span>Click or drag images here</span>
          <span className="text-xs">JPEG, PNG, WebP. Max 5 MB each</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
    </div>
  );
}

export function clearPendingImages(pending: PendingImage[]) {
  pending.forEach((p) => URL.revokeObjectURL(p.preview));
}
