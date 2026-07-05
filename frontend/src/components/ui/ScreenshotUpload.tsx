import { useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, ImageUp, Loader2, RotateCcw, ZoomIn } from 'lucide-react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ScreenshotUpload({
  label = 'Upload payment screenshot',
  imageUrl,
  uploading,
  onSelect,
  baseUrl = '',
  required = true,
}: {
  label?: string;
  imageUrl?: string;
  uploading: boolean;
  onSelect: (file: File) => void;
  baseUrl?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const fullUrl = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`) : '';

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return;
    onSelect(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink-muted">
        {label} {required && <span className="text-orange-500">*</span>}
      </label>

      {fullUrl && !uploading ? (
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block w-full"
          >
            <img
              src={fullUrl}
              alt="Payment proof"
              className="max-h-56 w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
              <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                <ZoomIn className="h-3.5 w-3.5" /> View full size
              </span>
            </span>
          </button>
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-600"
            >
              <RotateCcw className="h-3 w-3" /> Replace
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            isDragging
              ? 'border-orange-400 bg-orange-50/60'
              : 'border-border-light bg-subtle hover:border-orange-300 hover:bg-orange-50/30'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              <p className="text-sm font-medium text-slate-600">Uploading…</p>
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                <ImageUp className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-slate-700">
                <span className="text-orange-500">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-slate-400">JPG, PNG or WEBP</p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        disabled={uploading}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {lightboxOpen && fullUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <img src={fullUrl} alt="Payment proof full size" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
