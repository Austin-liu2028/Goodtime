import { useSyncExternalStore } from 'react';

// Minimal client-side routing on the History API. firebase.json already rewrites every
// path to index.html, so deep links like /e/K7MQ2P load the app.

const subscribe = (onChange: () => void) => {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
};

export const navigate = (path: string) => {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
};

export const usePathname = () => useSyncExternalStore(subscribe, () => window.location.pathname);
