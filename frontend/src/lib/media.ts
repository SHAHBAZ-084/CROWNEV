/** Resolve `/uploads/...` paths when API is on a different origin. */
export function resolveUploadUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = import.meta.env.VITE_API_URL ?? '/api';
  const origin = apiBase.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

/** Compare upload paths regardless of leading slash or resolved origin prefix. */
export function sameUploadUrl(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return (resolveUploadUrl(a) ?? a) === (resolveUploadUrl(b) ?? b);
}
