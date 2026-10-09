import { useEffect, useId, useRef, useState } from 'react';
import { EventStorageError, getInviteLink, subscribeToContacts } from '../services/events';
import type { ConfirmedTime, EventContact, ScheduledEvent } from '../types/event';
import {
  buildConfirmationEmail,
  buildRecipientDraft,
  getComposeUrl,
  getMailServiceName,
  isValidEmail,
  type MailService,
  uniqueRecipients,
} from '../utilities/email';
import { getRoster } from '../utilities/eventStatus';
import { CloseIcon } from './CloseIcon';

interface EmailComposerProps {
  event: ScheduledEvent;
  confirmedTime: ConfirmedTime;
}

const getKey = (email: string) => email.trim().toLowerCase();

interface ExtraRow extends EventContact {
  id: number;
}

const MAIL_SERVICES: MailService[] = ['gmail', 'outlook', 'default'];
const MAIL_SERVICE_KEY = 'goodtime:mail-service';
const isAppleDevice = () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

// Remembered per browser so the organizer only picks once.
const readMailService = (): MailService => {
  try {
    const saved = window.localStorage.getItem(MAIL_SERVICE_KEY);
    return MAIL_SERVICES.find((service) => service === saved) ?? 'gmail';
  } catch {
    return 'gmail';
  }
};

const saveMailService = (service: MailService) => {
  try {
    window.localStorage.setItem(MAIL_SERVICE_KEY, service);
  } catch {
    // Only a convenience; the choice still applies for this visit.
  }
};

let nextRowId = 0;
const createRow = (): ExtraRow => ({ id: (nextRowId += 1), name: '', email: '' });

// Organizer-only: drafts the "it's confirmed" email from the event details. Each person gets
// their own copy, addressed to them, from the organizer's own account; Goodtime sends nothing.
export const EmailComposer = ({ event, confirmedTime }: EmailComposerProps) => {
  const id = useId();
  const firstMissingEmailRef = useRef<HTMLInputElement>(null);
  const firstExtraEmailRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<EventContact[]>([]);
  const [contactsState, setContactsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [contactsError, setContactsError] = useState('');
  const [excludedEmails, setExcludedEmails] = useState<Set<string>>(() => new Set());
  const [extraRows, setExtraRows] = useState<ExtraRow[]>(() => [createRow()]);
  // Emails typed for people who responded or were invited without leaving one, by name.
  const [missingEmails, setMissingEmails] = useState<Record<string, string>>({});
  const [organizerName, setOrganizerName] = useState('');
  // Until the organizer edits the draft, it follows the template (e.g. as they type their name).
  const [editedSubject, setEditedSubject] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState<string | null>(null);
  // Whose drafts have been opened, so the organizer can keep track while working down the list.
  const [openedEmails, setOpenedEmails] = useState<Set<string>>(() => new Set());
  const [mailService, setMailService] = useState<MailService>(readMailService);
  // Whose email was just copied, for a moment of "Copied" on that row's button.
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    if (!copiedEmail) return;
    const timer = window.setTimeout(() => setCopiedEmail(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedEmail]);
  const serviceName = getMailServiceName(mailService, isAppleDevice());

  // Live, so an email someone leaves while this panel is open shows up straight away.
  useEffect(() => subscribeToContacts(
    event.code,
    (loaded) => {
      setContacts(loaded);
      setContactsState('ready');
    },
    (error) => {
      console.error(error);
      setContactsError(error instanceof EventStorageError ? error.message : 'Could not load participants’ emails.');
      setContactsState('error');
    },
  ), [event.code]);

  const emailInput = {
    title: event.title,
    description: event.description,
    location: event.location,
    timeZone: event.timeZone,
    confirmedTime,
    scheduleMode: event.scheduleMode,
    organizerName,
    eventLink: getInviteLink(event.code),
  };
  const template = buildConfirmationEmail(emailInput);
  const subject = editedSubject ?? template.subject;
  const body = editedBody ?? template.body;
  const isEdited = editedSubject !== null || editedBody !== null;

  // Everyone on the roster (invited or responded) with no saved email yet.
  const contactNameKeys = new Set(contacts.filter(({ email }) => isValidEmail(email)).map(({ name }) => getKey(name)));
  const namesWithoutEmail = getRoster(event).roster.filter((name) => !contactNameKeys.has(getKey(name)));
  const zoneForName = (name: string) => contacts.find((contact) => getKey(contact.name) === getKey(name) && contact.timeZone)?.timeZone;

  const recipients = uniqueRecipients([
    ...contacts.filter(({ email }) => isValidEmail(email) && !excludedEmails.has(getKey(email)))
      .map((contact) => ({ ...contact, timeZone: contact.timeZone ?? zoneForName(contact.name) })),
    ...namesWithoutEmail
      .filter((name) => isValidEmail(missingEmails[getKey(name)] ?? ''))
      .map((name) => ({ name, email: (missingEmails[getKey(name)] ?? '').trim(), timeZone: zoneForName(name) })),
    ...extraRows
      .filter((row) => isValidEmail(row.email))
      .map((row) => ({ name: row.name.trim(), email: row.email.trim(), timeZone: zoneForName(row.name) })),
  ]);

  const updateRow = (rowId: number, change: Partial<ExtraRow>) =>
    setExtraRows((rows) => rows.map((row) => (row.id === rowId ? { ...row, ...change } : row)));
  const addRow = () => setExtraRows((rows) => [...rows, createRow()]);
  // The last row empties instead of disappearing, so there's always somewhere to type.
  const removeRow = (rowId: number) =>
    setExtraRows((rows) => (rows.length === 1 ? [createRow()] : rows.filter((row) => row.id !== rowId)));

  const toggleContact = (email: string) => {
    setExcludedEmails((current) => {
      const next = new Set(current);
      if (next.has(getKey(email))) next.delete(getKey(email));
      else next.add(getKey(email));
      return next;
    });
  };

  const markOpened = (email: string) => setOpenedEmails((current) => new Set(current).add(getKey(email)));

  // For pasting into any mail app, or when the draft link doesn't open one.
  const copyDraft = async (email: string, draft: { to: string; subject: string; body: string }) => {
    try {
      await navigator.clipboard.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`);
      setCopyError('');
      setCopiedEmail(getKey(email));
    } catch (error) {
      console.error(error);
      setCopyError('Copy failed. Open the email instead, or select the message above and copy it.');
    }
  };

  return (
    <section className="email-composer" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="panel-heading">Email everyone</h2>
      <p className="composer-lede">
        Each person gets their own email from your account, addressed to them by name. No one sees who else it went to, and replies come straight to you.
      </p>

      <fieldset className="composer-recipients">
        <legend className="field-label">Recipients</legend>
        {contactsState === 'loading' && <p className="field-hint">Loading emails…</p>}
        {contactsState === 'error' && <p className="form-error" role="alert">{contactsError}</p>}
        {contactsState === 'ready' && !contacts.some(({ email }) => isValidEmail(email)) && (
          <p className="field-hint">No one has left an email yet. Participants can add one when they submit their times.</p>
        )}
        {contacts.some(({ email }) => isValidEmail(email)) && (
          <ul className="recipient-list">
            {contacts.filter(({ email }) => isValidEmail(email)).map((contact) => (
              <li key={`${contact.name}|${contact.email}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={!excludedEmails.has(getKey(contact.email))}
                    onChange={() => toggleContact(contact.email)}
                  />
                  <span><strong>{contact.name}</strong> {contact.email}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {contactsState === 'ready' && namesWithoutEmail.length > 0 && (
        <fieldset className="field extra-people">
          <legend className="field-label">No email yet <span>Optional</span></legend>
          <p className="field-hint">These people responded or were invited but didn’t leave an email. Add one to include them.</p>
          {namesWithoutEmail.map((name, index) => {
            const value = missingEmails[getKey(name)] ?? '';
            const isInvalid = value.trim() !== '' && !isValidEmail(value);
            return (
              <div className="extra-person" key={getKey(name)}>
                <div className="missing-email-fields">
                  <span className="missing-email-name">{name}</span>
                  <input
                    ref={index === 0 ? firstMissingEmailRef : undefined}
                    className="text-field"
                    type="email"
                    value={value}
                    onChange={(changeEvent) => setMissingEmails((current) => ({ ...current, [getKey(name)]: changeEvent.target.value }))}
                    placeholder="Email"
                    aria-label={`Email for ${name}`}
                    aria-invalid={isInvalid || undefined}
                    autoComplete="off"
                    maxLength={254}
                  />
                </div>
                {isInvalid && <p className="form-error">Check this email address.</p>}
              </div>
            );
          })}
        </fieldset>
      )}

      <fieldset className="field extra-people">
        <legend className="field-label">Add more people <span>Optional</span></legend>
        <p className="field-hint">For anyone who didn’t leave an email, like people who haven’t responded.</p>
        {extraRows.map((row, index) => {
          const isInvalid = row.email.trim() !== '' && !isValidEmail(row.email);
          return (
            <div className="extra-person" key={row.id}>
              <div className="extra-person-fields">
                <input
                  className="text-field"
                  value={row.name}
                  onChange={(changeEvent) => updateRow(row.id, { name: changeEvent.target.value })}
                  placeholder="Name"
                  aria-label={`Name for person ${index + 1}`}
                  autoComplete="off"
                  maxLength={50}
                />
                <input
                  ref={index === 0 ? firstExtraEmailRef : undefined}
                  className="text-field"
                  type="email"
                  value={row.email}
                  onChange={(changeEvent) => updateRow(row.id, { email: changeEvent.target.value })}
                  placeholder="Email"
                  aria-label={`Email for person ${index + 1}`}
                  aria-invalid={isInvalid || undefined}
                  autoComplete="off"
                  maxLength={254}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => removeRow(row.id)}
                  aria-label={`Remove person ${index + 1}`}
                >
                  <CloseIcon />
                </button>
              </div>
              {isInvalid && <p className="form-error">Check this email address.</p>}
            </div>
          );
        })}
        <button type="button" className="text-button" onClick={addRow}>
          <span aria-hidden="true">+</span>&nbsp;Add another person
        </button>
      </fieldset>

      <div className="field composer-name">
        <label className="field-label" htmlFor={`${id}-name`}>Sign off as <span>Optional</span></label>
        <input
          id={`${id}-name`}
          className="text-field"
          value={organizerName}
          onChange={(changeEvent) => setOrganizerName(changeEvent.target.value)}
          placeholder="Your name"
          autoComplete="name"
          maxLength={50}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${id}-subject`}>Subject</label>
        <input
          id={`${id}-subject`}
          className="text-field"
          value={subject}
          onChange={(changeEvent) => setEditedSubject(changeEvent.target.value)}
        />
      </div>

      <div className="field">
        <div className="composer-message-label">
          <label className="field-label" htmlFor={`${id}-body`}>Message</label>
          {isEdited && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setEditedSubject(null);
                setEditedBody(null);
              }}
            >
              Reset to template
            </button>
          )}
        </div>
        <textarea
          id={`${id}-body`}
          className="text-field composer-body"
          rows={16}
          value={body}
          onChange={(changeEvent) => setEditedBody(changeEvent.target.value)}
        />
        <p className="field-hint">Each draft converts the meeting time to that recipient’s saved time zone. Keep the Time line if you edit the message.</p>
      </div>

      <div className="composer-send">
        <h3 className="field-label">
          Send <span>{recipients.length === 0 ? 'Add at least one email' : `${recipients.length} ${recipients.length === 1 ? 'email' : 'emails'}, one per person`}</span>
        </h3>
        <div className="mail-service-row">
          <div className="mail-service" role="radiogroup" aria-label="Send with">
            <span className="mail-service-label" aria-hidden="true">Send with</span>
            {MAIL_SERVICES.map((service) => (
              <label key={service} className={`mail-service-option${service === mailService ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name={`${id}-service`}
                  value={service}
                  checked={service === mailService}
                  onChange={() => {
                    setMailService(service);
                    saveMailService(service);
                  }}
                />
                {getMailServiceName(service, isAppleDevice())}
              </label>
            ))}
          </div>
          {contactsState === 'ready' && recipients.length === 0 && (
            <button
              type="button"
              className="text-button mail-service-empty"
              onClick={() => (firstMissingEmailRef.current ?? firstExtraEmailRef.current)?.focus()}
            >
              ↑ Add an email above before sending
            </button>
          )}
        </div>
        {mailService === 'default' && (
          <p className="field-hint">
            Opens the mail app this {isAppleDevice() ? 'Mac or iPhone' : 'device'} uses for email links{isAppleDevice() ? ', which is Apple Mail unless you’ve changed it' : ''}.
          </p>
        )}
        {recipients.length > 0 && (
          <ul className="send-list">
            {recipients.map((recipient) => {
              const draft = buildRecipientDraft(emailInput, recipient, { subject, body });
              const isOpened = openedEmails.has(getKey(recipient.email));
              const label = recipient.name || recipient.email;
              return (
                <li key={getKey(recipient.email)}>
                  <span className="send-who">
                    {recipient.name && <strong>{recipient.name}</strong>}
                    <span>{recipient.email}</span>
                  </span>
                  {isOpened && <span className="send-status">Draft opened</span>}
                  <a
                    className="button button-primary button-small"
                    href={getComposeUrl(mailService, draft)}
                    {...(mailService === 'default' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                    aria-label={`Open ${label}’s email in ${serviceName}`}
                    onClick={() => markOpened(recipient.email)}
                  >
                    Open email
                  </a>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    aria-label={`Copy ${label}’s email`}
                    onClick={() => copyDraft(recipient.email, draft)}
                  >
                    {copiedEmail === getKey(recipient.email) ? 'Copied' : 'Copy email'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="share-message" aria-live="polite">
          {copyError || (copiedEmail ? 'Email copied: recipient, subject and message. Paste it into any mail app.' : '')}
        </p>
      </div>
    </section>
  );
};
