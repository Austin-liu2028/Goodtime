import type { PropsWithChildren } from 'react';
import { AccountMenu } from './AccountMenu';
import { BrandMark } from './BrandMark';
import { ConsentBanner } from './ConsentBanner';
import { Link } from './Link';

interface PageShellProps {
  pathname: string;
}

// The header doubles as the way out of any page: home, join another event, or start a new one.
export const PageShell = ({ pathname, children }: PropsWithChildren<PageShellProps>) => (
  <div className="page-shell">
    <header className="topbar">
      <Link to="/" className="wordmark" ariaLabel="Goodtime home">
        <BrandMark size={34} />
        <span className="wordmark-name">goodtime</span>
      </Link>
      <div className="topbar-actions">
        {pathname !== '/' && (
          <nav className="topnav" aria-label="Main">
            {pathname !== '/join' && <Link to="/join" className="nav-link">Join with a code</Link>}
            {pathname !== '/create' && <Link to="/create" className="button button-primary button-small">New event</Link>}
          </nav>
        )}
        <AccountMenu />
      </div>
    </header>

    <main id="main">{children}</main>

    <footer className="site-footer">
      <span>© 2026 Goodtime</span>
      <nav aria-label="Legal">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Use</Link>
      </nav>
    </footer>

    <ConsentBanner />
  </div>
);
