import type { PropsWithChildren } from 'react';
import { Link } from './Link';

export const PageShell = ({ children }: PropsWithChildren) => (
  <main className="page-shell">
    <header className="topbar">
      <Link to="/" className="wordmark" ariaLabel="Goodtime home">
        <span className="wordmark-mark" aria-hidden="true">g</span>
        <span>goodtime</span>
      </Link>
      <span className="topbar-note">A little less back-and-forth</span>
      <span className="draft-indicator"><span /> Saved in this browser</span>
    </header>

    {children}

    <footer className="page-footer">
      <span>GOODTIME <span className="footer-dot">/</span> BETTER PLANS, TOGETHER</span>
      <span>ONE EVENT AT A TIME</span>
    </footer>
  </main>
);
