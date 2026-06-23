import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { resolveUploadUrl } from '../../lib/media';

type BranchPhotoFieldProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
};

export function BranchPhotoField({
  value,
  onChange,
  pendingFile,
  onPendingFileChange,
}: BranchPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFile) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(pendingFile);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pendingFile]);

  const displaySrc = preview ?? resolveUploadUrl(value) ?? null;

  function clearPhoto() {
    onPendingFileChange(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onFilePick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    onPendingFileChange(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-brand">Branch photo</p>
      <p className="mb-3 text-xs text-text-muted">
        Shown on branch cards across the website. JPEG, PNG, or WebP — max 10 MB.
      </p>

      {displaySrc ? (
        <div className="relative inline-block overflow-hidden rounded-xl border border-border bg-surface-alt">
          <img src={displaySrc} alt="" className="h-32 w-48 object-cover sm:h-36 sm:w-56" />
          <button
            type="button"
            onClick={clearPhoto}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-text-muted shadow-sm transition-colors hover:bg-white hover:text-danger"
            aria-label="Remove branch photo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full max-w-xs flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-alt/50 text-text-muted transition-colors hover:border-accent/40 hover:bg-accent/5 hover:text-brand"
        >
          <ImagePlus className="h-8 w-8 text-accent/70" />
          <span className="text-sm font-medium">Upload branch photo</span>
        </button>
      )}

      {displaySrc ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 text-sm font-medium text-accent hover:underline"
        >
          Replace photo
        </button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onFilePick(e.target.files)}
      />
    </div>
  );
}
