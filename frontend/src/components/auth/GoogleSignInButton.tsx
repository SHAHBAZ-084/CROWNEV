import { useEffect, useRef, useState } from 'react';
import { ensureGoogleScript, GOOGLE_CLIENT_ID, isGoogleSignInEnabled } from '../../lib/googleSignIn';

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export function AuthFormDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border-light" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wide">
        <span className="bg-elevated px-2 text-ink-muted">or</span>
      </div>
    </div>
  );
}

type GoogleSignInButtonProps = {
  onCredential: (idToken: string) => void | Promise<void>;
  onConfigError?: (message: string) => void;
  disabled?: boolean;
  loading?: boolean;
};

const CONFIG_MESSAGE =
  'Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to frontend/.env and GOOGLE_CLIENT_ID to backend/.env, then restart both servers.';

export function GoogleSignInButton({
  onCredential,
  onConfigError,
  disabled,
  loading,
}: GoogleSignInButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const configErrorRef = useRef(onConfigError);
  callbackRef.current = onCredential;
  configErrorRef.current = onConfigError;
  const [gsiReady, setGsiReady] = useState(false);
  const [gsiError, setGsiError] = useState(false);
  const configured = isGoogleSignInEnabled();

  useEffect(() => {
    if (!configured) return;

    let cancelled = false;

    ensureGoogleScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.google?.accounts?.id) return;

        hostRef.current.replaceChildren();

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) void callbackRef.current(response.credential);
          },
        });

        const width = hostRef.current.parentElement?.clientWidth ?? 384;
        window.google.accounts.id.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: Math.max(Math.floor(width), 200),
        });

        setGsiReady(true);
        setGsiError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setGsiReady(false);
          setGsiError(true);
          configErrorRef.current?.('Could not load Google Sign-In. Check your connection or ad blocker.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [configured]);

  function handleUnconfiguredClick() {
    onConfigError?.(CONFIG_MESSAGE);
  }

  const blocked = disabled || loading;
  const overlayActive = configured && gsiReady && !blocked;

  const label = loading
    ? 'Signing in…'
    : configured && !gsiReady && !gsiError
      ? 'Loading Google…'
      : 'Continue with Google';

  return (
    <div className="relative h-11 w-full">
      <div
        className={`flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border-light bg-white text-sm font-medium text-ink shadow-sm transition ${
          blocked ? 'opacity-60' : ''
        }`}
        aria-hidden
      >
        <GoogleIcon />
        <span>{label}</span>
      </div>
      {configured ? (
        <div
          ref={hostRef}
          className={`absolute inset-0 z-10 overflow-hidden rounded-xl ${
            overlayActive ? 'cursor-pointer opacity-[0.011]' : 'pointer-events-none opacity-0'
          } [&>div]:!h-full [&>div]:!w-full [&_iframe]:!h-11 [&_iframe]:!w-full`}
          aria-label="Continue with Google"
        />
      ) : (
        <button
          type="button"
          onClick={handleUnconfiguredClick}
          className="absolute inset-0 z-10 w-full rounded-xl"
          aria-label="Continue with Google"
        />
      )}
    </div>
  );
}

export { isGoogleSignInEnabled };
