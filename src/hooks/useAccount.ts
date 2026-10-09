import { useEffect, useState } from 'react';
import { subscribeToAccount } from '../services/events';
import type { Account } from '../types/event';

// The optional Google sign-in state, kept current.
export const useAccount = () => {
  const [account, setAccount] = useState<Account>({ isSignedIn: false, name: '', email: '' });
  useEffect(() => subscribeToAccount(setAccount), []);
  return account;
};
