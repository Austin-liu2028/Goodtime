import { useEffect, useState } from 'react';
import { getInviteLink } from '../services/events';
import { Link } from './Link';

interface SharePanelProps {
  code: string;
  // A ready-to-paste nudge for the group chat.
  reminder: string;
}

type CopyTarget = 'link' | 'code' | 'reminder';

const COPIED_MESSAGES: Record<CopyTarget, string> = {
  link: 'Link copied.',
  code: 'Code copied.',
  reminder: 'Reminder copied. Paste it into your group chat.',
};

// Organizer-only: the link to share, the code to read out, a reminder to paste, and editing.
export const SharePanel = ({ code, reminder }: SharePanelProps) => {
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [copyError, setCopyError] = useState('');
  const inviteLink = getInviteLink(code);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (text: string, target: CopyTarget) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyError('');
      setCopied(target);
    } catch (error) {
      console.error(error);
      setCopyError('Copy failed. Select the text and copy it manually.');
    }
  };

  return (
    <section className="share-panel" aria-labelledby="share-heading">
      <div className="panel-title">
        <h2 id="share-heading">Invite people</h2>
        <Link to={`/e/${code}/edit`} className="text-link">Edit event</Link>
      </div>
      <div className="share-row">
        <div className="share-value">
          <span className="share-label">Invite link</span>
          <span className="share-link">{inviteLink}</span>
        </div>
        <button type="button" className="button button-secondary button-small" onClick={() => copy(inviteLink, 'link')}>
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <div className="share-row">
        <div className="share-value">
          <span className="share-label">Event code</span>
          <strong className="event-code">{code}</strong>
        </div>
        <button type="button" className="button button-secondary button-small" onClick={() => copy(code, 'code')}>
          {copied === 'code' ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <div className="share-row share-reminder">
        <div className="share-value">
          <span className="share-label">Reminder message</span>
          <p className="reminder-text">{reminder}</p>
        </div>
        <button type="button" className="button button-secondary button-small" onClick={() => copy(reminder, 'reminder')}>
          {copied === 'reminder' ? 'Copied' : 'Copy reminder'}
        </button>
      </div>
      <p className="share-message" aria-live="polite">{copyError || (copied ? COPIED_MESSAGES[copied] : '')}</p>
    </section>
  );
};
