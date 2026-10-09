import { useState } from 'react';
import { useAccount } from '../hooks/useAccount';
import { canSignIn, EventStorageError, signInWithGoogle, signOutOfGoogle } from '../services/events';
import { GoogleLogo } from './GoogleLogo';

// Optional Google sign-in. Everything works without it; signing in keeps your events and the
// ones you joined on every device, and signing in again elsewhere brings them along.
export const AccountMenu = () => {
  const account = useAccount();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  if (!canSignIn) return null;

  const run = async (task: () => Promise<boolean | void>) => {
    setIsBusy(true);
    setError('');
    try {
      // Reload so every page picks up the account's events and organizer access.
      if ((await task()) !== false) window.location.reload();
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof EventStorageError ? caught.message : 'Something went wrong. Try again.');
    }
    setIsBusy(false);
  };

  return (
    <div className="account-menu">
      {account.isSignedIn ? (
        <>
          <span className="account-name" title={account.email}>{account.name || account.email}</span>
          <button type="button" className="text-button" disabled={isBusy} onClick={() => run(signOutOfGoogle)}>
            Sign out
          </button>
        </>
      ) : (
        <button
          type="button"
          className="google-sign-in"
          disabled={isBusy}
          onClick={() => run(signInWithGoogle)}
          aria-label="Sign in with Google (optional, keeps your events on every device)"
          title="Optional: keep your events on every device"
        >
          <GoogleLogo />
          <span className="google-sign-in-label">{isBusy ? 'Signing in…' : 'Sign in with Google'}</span>
        </button>
      )}
      {error && <p className="account-error" role="alert">{error}</p>}
    </div>
  );
};
