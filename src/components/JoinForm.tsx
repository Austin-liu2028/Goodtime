import { useId, useState, type FormEvent } from 'react';
import { navigate } from '../hooks/useRoute';
import { EventStorageError, extractEventCode, getEvent } from '../services/events';

// Code-or-link lookup, shared by the home page and /join.
export const JoinForm = () => {
  const inputId = useId();
  const errorId = useId();
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = extractEventCode(codeInput);
    if (!code) {
      setError('Enter the event code or paste your invite link.');
      return;
    }
    setError('');
    setIsChecking(true);
    try {
      const found = await getEvent(code);
      if (found) {
        navigate(`/e/${found.code}`);
        return;
      }
      setError(`No event found for “${code}”. Check the code with your organizer.`);
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof EventStorageError ? caught.message : 'Could not look up that event. Try again.');
    }
    setIsChecking(false);
  };

  return (
    <form className="join-form" onSubmit={submit} noValidate>
      <label className="field-label" htmlFor={inputId}>Event code or link</label>
      <div className="join-row">
        <input
          id={inputId}
          className="text-field code-field"
          value={codeInput}
          onChange={(event) => setCodeInput(event.target.value)}
          placeholder="K7MQ2P"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" className="button button-primary" disabled={isChecking}>
          {isChecking ? 'Checking…' : 'Join'}
        </button>
      </div>
      <p className="form-error" id={errorId} role={error ? 'alert' : undefined}>{error}</p>
    </form>
  );
};
