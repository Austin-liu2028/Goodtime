import { useState } from 'react';
import { getInviteLink } from '../services/events';

interface SharePanelProps {
  code: string;
}

// Organizer-only: the code to read out and the link to paste into a group chat.
export const SharePanel = ({ code }: SharePanelProps) => {
  const [copyMessage, setCopyMessage] = useState('');
  const inviteLink = getInviteLink(code);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(`${label} copied.`);
    } catch (error) {
      console.error(error);
      setCopyMessage('Copy failed. Select the text and copy it manually.');
    }
  };

  return (
    <section className="share-panel" aria-labelledby="share-heading">
      <div className="eyebrow schedule-eyebrow" id="share-heading">INVITE YOUR GROUP</div>
      <div className="share-row">
        <div>
          <span className="share-label">Event code</span>
          <strong className="event-code">{code}</strong>
        </div>
        <button type="button" className="week-button" onClick={() => copy(code, 'Code')}>Copy code</button>
      </div>
      <div className="share-row">
        <div className="share-link-wrap">
          <span className="share-label">Invite link</span>
          <span className="share-link">{inviteLink}</span>
        </div>
        <button type="button" className="week-button" onClick={() => copy(inviteLink, 'Link')}>Copy link</button>
      </div>
      <p className="share-message" aria-live="polite">{copyMessage}</p>
    </section>
  );
};
