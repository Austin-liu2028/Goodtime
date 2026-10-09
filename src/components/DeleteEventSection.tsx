import { useState } from 'react';
import { navigate } from '../hooks/useRoute';
import { deleteEvent, EventStorageError } from '../services/events';

interface DeleteEventSectionProps {
  code: string;
  title: string;
  compact?: boolean;
  onDeleted?: () => void;
}

// Organizer-only control shared by the edit page and the organizer's home list.
export const DeleteEventSection = ({ code, title, compact = false, onDeleted }: DeleteEventSectionProps) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await deleteEvent(code);
      if (onDeleted) onDeleted();
      else navigate('/');
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof EventStorageError ? caught.message : 'Could not delete the event. Try again.');
      setIsDeleting(false);
    }
  };

  const control = (
    <>
      {!isConfirming ? (
        <>
          {!compact && <p>Removes the event, everyone’s responses, saved emails and suggested times. The link will stop working.</p>}
          <button
            type="button"
            className={`button button-danger${compact ? ' button-small' : ''}`}
            aria-label={compact ? `Delete ${title}` : undefined}
            onClick={() => setIsConfirming(true)}
          >
            {compact ? 'Delete' : 'Delete event'}
          </button>
        </>
      ) : (
        <div className="delete-confirm" role="alertdialog" aria-labelledby={`delete-confirm-${code}`}>
          <p id={`delete-confirm-${code}`}>
            <strong>Delete “{title}”?</strong> Everyone’s responses, emails and suggestions are deleted too. This can’t be undone.
          </p>
          <div className="button-row">
            <button type="button" className="button button-danger-solid" onClick={remove} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete for good'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setIsConfirming(false)}
              disabled={isDeleting}
              // The safe choice gets focus first, so Enter doesn't delete by accident.
              autoFocus
            >
              Keep event
            </button>
          </div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );

  if (compact) {
    return <div className={`home-delete-control${isConfirming ? ' is-confirming' : ''}`}>{control}</div>;
  }

  return (
    <section className="delete-event" aria-labelledby="delete-heading">
      <h2 id="delete-heading">Delete event</h2>
      {control}
    </section>
  );
};
