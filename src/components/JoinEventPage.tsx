import { useState, type FormEvent } from 'react';
import { navigate } from '../hooks/useRoute';
import { EventStorageError, extractEventCode, getEvent } from '../services/events';
import { Link } from './Link';

export const JoinEventPage = () => {
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
      setError(`No event found for "${code}". Check the code with your organizer.`);
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof EventStorageError ? caught.message : 'Could not look up that event. Try again.');
    }
    setIsChecking(false);
  };

  return (
    <section className="narrow-page" aria-labelledby="join-heading">
      <Link to="/" className="back-link"><span aria-hidden="true">←</span> Back</Link>
      <div className="eyebrow"><span className="eyebrow-line" /> JOIN AN EVENT</div>
      <h1 id="join-heading">Got an invite?</h1>
      <p className="intro-copy">Enter the 6-character code from your organizer, or paste the invite link.</p>

      <form className="join-form" onSubmit={submit} noValidate>
        <label className="field-label" htmlFor="event-code">EVENT CODE OR LINK</label>
        <div className="join-row">
          <input
            id="event-code"
            className="text-field code-field"
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            placeholder="e.g. K7MQ2P"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button type="submit" className="submit-button" disabled={isChecking}>
            {isChecking ? 'Checking…' : 'Join'}
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </section>
  );
};
