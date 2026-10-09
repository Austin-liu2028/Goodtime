import { useEffect, useState } from 'react';
import { getInviteLink } from '../services/events';
import { Link } from './Link';

interface SharePanelProps {
  code: string;
  title: string;
  // The invitation, nudge or announcement to send, without the link.
  message: string;
}

type CopyTarget = 'invite' | 'code';

const COPIED_MESSAGES: Record<CopyTarget, string> = {
  invite: 'Invite copied. Paste it into your group chat.',
  code: 'Code copied.',
};

// Phones and tablets get the system share sheet (WeChat, Messages…); elsewhere copying is quicker.
const canUseShareSheet = () =>
  typeof navigator.share === 'function' && window.matchMedia?.('(pointer: coarse)').matches === true;

// Organizer-only. One thing to send: the link already opens the event, so nobody needs the
// code; it's tucked away for telling people in person.
export const SharePanel = ({ code, title, message }: SharePanelProps) => {
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [copyError, setCopyError] = useState('');
  const [editedInvite, setEditedInvite] = useState<string | null>(null);
  const inviteLink = getInviteLink(code);
  const fullInvite = `${message}\n${inviteLink}`;
  const inviteText = editedInvite ?? fullInvite;
  const useShareSheet = canUseShareSheet();

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (text: string, target: CopyTarget) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyError('');
      setCopied(target);
    } catch (error) {
      console.error(error);
      setCopyError('Copy failed. Select the message and copy it manually.');
    }
  };

  const shareInvite = async () => {
    if (!useShareSheet) {
      await copy(inviteText, 'invite');
      return;
    }
    try {
      await navigator.share({ title, text: inviteText });
    } catch (error) {
      // Closing the share sheet isn't a failure; anything else falls back to copying.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await copy(inviteText, 'invite');
    }
  };

  return (
    <section className="share-panel" aria-labelledby="share-heading">
      <div className="panel-title">
        <h2 id="share-heading">Invite people</h2>
        <Link to={`/e/${code}/edit`} className="text-link">Edit event</Link>
      </div>

      <label className="visually-hidden" htmlFor="invite-message">Invite message</label>
      <textarea
        id="invite-message"
        className="invite-editor"
        value={inviteText}
        onChange={(event) => {
          setEditedInvite(event.target.value);
          setCopied(null);
        }}
        rows={5}
      />
      {editedInvite !== null && (
        <button type="button" className="text-button invite-reset" onClick={() => setEditedInvite(null)}>
          Reset invite
        </button>
      )}

      <button type="button" className="button button-primary share-invite" onClick={shareInvite}>
        {copied === 'invite' ? 'Copied' : useShareSheet ? 'Share invite' : 'Copy invite'}
      </button>

      <details className="share-code">
        <summary>Joining in person? Click here to share the code</summary>
        <div className="share-row">
          <div className="share-value">
            <span className="share-label">Enter it on the Goodtime home page</span>
            <strong className="event-code">{code}</strong>
          </div>
          <button type="button" className="button button-secondary button-small" onClick={() => copy(code, 'code')}>
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </button>
        </div>
      </details>

      <p className="share-message" aria-live="polite">{copyError || (copied ? COPIED_MESSAGES[copied] : '')}</p>
    </section>
  );
};
