'use client';

import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: any;
  }
}

/** Loads the Google Identity Services script once, shared across mounts. */
function loadGsi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GSI load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('GSI load failed'));
    document.head.appendChild(s);
  });
}

interface Props {
  /** Called with the Google ID token credential once the user picks an account. */
  onCredential: (credential: string) => void;
  disabled?: boolean;
}

/**
 * Renders Google's official Sign-In button when NEXT_PUBLIC_GOOGLE_CLIENT_ID is
 * configured. When it isn't, renders a styled placeholder so the option is
 * still visible, with a hint that the server needs configuring.
 */
export default function GoogleSignInButton({ onCredential, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID || !containerRef.current) return;
    let cancelled = false;

    loadGsi()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp: { credential?: string }) => {
            if (resp.credential) onCredential(resp.credential);
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 360,
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
        });
        setReady(true);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [onCredential]);

  // Not configured (or script blocked) → styled, non-functional placeholder.
  if (!CLIENT_ID || failed) {
    return (
      <div>
        <button
          type="button"
          disabled
          title="Set NEXT_PUBLIC_GOOGLE_CLIENT_ID (web) and GOOGLE_CLIENT_ID (API) to enable"
          className="w-full flex items-center justify-center gap-3 py-3 rounded-full border border-slate-200
                     bg-white text-sm font-semibold text-slate-700 opacity-70 cursor-not-allowed"
        >
          <GoogleG />
          Continue with Google
        </button>
        <p className="text-[11px] text-slate-400 text-center mt-1.5">
          Google Sign-In activates once configured
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div ref={containerRef} className={disabled ? 'pointer-events-none opacity-60' : ''} />
      {!ready && (
        <div className="w-full h-[44px] rounded-full border border-slate-200 bg-slate-50 animate-pulse" />
      )}
    </div>
  );
}

function GoogleG() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z" />
    </svg>
  );
}
