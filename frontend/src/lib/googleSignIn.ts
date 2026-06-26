export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

export function isGoogleSignInEnabled() {
  return GOOGLE_CLIENT_ID.length > 0;
}

let scriptPromise: Promise<void> | null = null;

export function ensureGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const src = 'https://accounts.google.com/gsi/client';
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;

    const finish = () => {
      const wait = () => {
        if (window.google?.accounts?.id) resolve();
        else window.setTimeout(wait, 50);
      };
      wait();
    };

    if (existing) {
      if (existing.dataset.loaded === 'true') finish();
      else existing.addEventListener('load', finish, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      finish();
    };
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}
