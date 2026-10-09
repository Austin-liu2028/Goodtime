import { useState } from 'react';
import { CONSENT_VERSION } from '../utilities/legal';
import { Link } from './Link';

const CONSENT_KEY = 'goodtime:consent';

// Records which version of the Terms and Privacy Policy this browser accepted, and when.
const hasAcceptedCurrentVersion = () => {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(CONSENT_KEY) ?? 'null');
    return typeof saved === 'object' && saved !== null && 'version' in saved && saved.version === CONSENT_VERSION;
  } catch {
    return false;
  }
};

const recordAcceptance = () => {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: CONSENT_VERSION, acceptedAt: new Date().toISOString() }));
  } catch {
    // Storage is blocked: the banner simply comes back next visit.
  }
};

// Browsers can send a Global Privacy Control signal asking sites not to sell or share data.
const hasGlobalPrivacyControl = () =>
  (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

// Goodtime has no advertising or tracking cookies; this tells people what browser storage it
// does use, and accepting is agreeing to the Terms of Use and Privacy Policy.
export const ConsentBanner = () => {
  const [isAccepted, setIsAccepted] = useState(hasAcceptedCurrentVersion);

  if (isAccepted) return null;

  return (
    <section className="consent-banner" aria-labelledby="consent-heading">
      <div className="consent-copy">
        <h2 id="consent-heading">Cookies and privacy</h2>
        <p>
          Goodtime doesn’t use advertising or tracking cookies. It uses essential browser storage to keep your anonymous
          session and remember your choices. By selecting Accept, you agree to our{' '}
          <Link to="/terms">Terms of Use</Link> and <Link to="/privacy">Privacy Policy</Link>.
        </p>
        {hasGlobalPrivacyControl() && (
          <p className="consent-note">Your browser’s Global Privacy Control signal is honored. We don’t sell or share personal information.</p>
        )}
      </div>
      <button
        type="button"
        className="button button-primary"
        onClick={() => {
          recordAcceptance();
          setIsAccepted(true);
        }}
      >
        Accept
      </button>
    </section>
  );
};
