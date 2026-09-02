'use client';

import { useEffect } from 'react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Replaces the whole document, so it cannot rely on the app stylesheet being
 * present. Everything here is inline.
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f5f6f7',
          color: '#1a1a2e',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: '#ffffff',
            border: '1px solid #e8eaec',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#063932' }}>Something broke</h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', lineHeight: 1.5, color: '#5b6469' }}>
            EventPeepo could not render this page. Reloading usually fixes it.
          </p>
          {error?.digest ? (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6e777d', fontFamily: 'ui-monospace, monospace' }}>
              Reference {error.digest}
            </p>
          ) : null}

          <div style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <a
              href="/"
              style={{
                minHeight: '40px',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid #8d979d',
                color: '#1a1a2e',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Go home
            </a>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: '40px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#063932',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
