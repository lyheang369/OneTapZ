import { Component } from 'react';
import type { ReactNode } from 'react';

const RELOAD_AT = 'onetapz_chunk_reload_at';

// A failed dynamic import (common after a redeploy invalidates old chunk hashes)
// throws a chunk-load error; without a boundary that crashes the tree to a blank
// screen. Detect those and reload once to fetch the fresh build.
function isChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|importing a module script failed|chunkloaderror|loading chunk|failed to fetch/i.test(message);
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Stale-chunk crash: reload once to get the latest build. Guard with a
    // timestamp so a genuinely broken deploy can't loop-reload forever.
    if (isChunkError(error)) {
      const last = Number(sessionStorage.getItem(RELOAD_AT) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(RELOAD_AT, String(Date.now()));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="page-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f4f4ec' }}>Something went wrong</h1>
            <p style={{ marginTop: 10, color: '#8f8f86' }}>The app hit an error. Reloading usually fixes it.</p>
            <button className="btn-primary" style={{ marginTop: 18 }} type="button" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
