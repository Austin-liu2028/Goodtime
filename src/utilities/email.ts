import type { ConfirmedTime, EventContact } from '../types/event';
import { getMeetingTimeText } from './zonedSchedule';
import { isSelectableTimeZone } from './timeZones';

// Confirmation emails drafted for the organizer to send from their own mail account, one per
// person, so nobody sees anyone else's name or address. Goodtime never sends mail itself.

// Stands in for each recipient's name in the shared template.
export const NAME_PLACEHOLDER = '{name}';

const EMAIL_PATTERN = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());

// Case-insensitive de-duplication by address, keeping the first (so a known name wins).
export const uniqueRecipients = (recipients: EventContact[]) => {
  const seen = new Set<string>();
  return recipients.filter(({ email }) => {
    const key = email.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

interface ConfirmationEmailInput {
  title: string;
  description: string;
  location: string;
  timeZone: string;
  displayTimeZone?: string;
  confirmedTime: ConfirmedTime;
  scheduleMode?: 'dates' | 'weekdays';
  organizerName: string;
  eventLink: string;
}

// The shared template, with {name} in the greeting for each person's own name.
export const buildConfirmationEmail = (input: ConfirmationEmailInput) => {
  const time = getMeetingTimeText({
    confirmedTime: input.confirmedTime,
    scheduleMode: input.scheduleMode,
    eventTimeZone: input.timeZone,
    displayTimeZone: input.displayTimeZone ?? input.timeZone,
    weeklyLabel: 'next',
  });
  const organizer = input.organizerName.trim();

  const details = [
    `Time: ${time.bodyTime}`,
    input.location && `Address: ${input.location}`,
  ].filter(Boolean);

  const sections = [
    `Hi ${NAME_PLACEHOLDER},`,
    `Thank you for sharing your availability! We found a time that works, so “${input.title}” is officially on the calendar.`,
    details.join('\n'),
    input.description && `A note from ${organizer || 'the organizer'}:\n${input.description}`,
    input.scheduleMode === 'weekdays'
      ? `Download the weekly calendar invite for Google Calendar, Apple Calendar or Outlook from the event page:\n${input.eventLink}`
      : `Add it to your calendar (Google Calendar, Apple Calendar or Outlook) from the event page:\n${input.eventLink}`,
    input.scheduleMode === 'weekdays' && 'This meeting repeats every week. Your local hour may change when daylight saving clocks change; the calendar invite will adjust automatically.',
    'If anything changes on your end, just reply to this email and let me know.',
    organizer ? `Looking forward to seeing you there!\n\nBest,\n${organizer}` : 'Looking forward to seeing you there!',
  ].filter(Boolean);

  return {
    subject: `Meeting time confirmed: ${input.title} on ${time.subjectTime}`,
    body: sections.join('\n\n'),
  };
};

// Fills in one recipient. Someone added by address alone is addressed by that address.
export const personalize = (text: string, recipient: EventContact) =>
  text.split(NAME_PLACEHOLDER).join(recipient.name.trim() || recipient.email);

// Keep the shared editable draft in the event zone. At compose time, replace only the
// meeting-time text for this recipient, so each message shows exactly one time zone.
export const buildRecipientDraft = (
  input: ConfirmationEmailInput,
  recipient: EventContact,
  edited: { subject: string; body: string },
) => {
  const eventTime = getMeetingTimeText({
    confirmedTime: input.confirmedTime, scheduleMode: input.scheduleMode,
    eventTimeZone: input.timeZone, displayTimeZone: input.timeZone, weeklyLabel: 'next',
  });
  const recipientTime = getMeetingTimeText({
    confirmedTime: input.confirmedTime, scheduleMode: input.scheduleMode,
    eventTimeZone: input.timeZone,
    displayTimeZone: recipient.timeZone && isSelectableTimeZone(recipient.timeZone) ? recipient.timeZone : input.timeZone,
    weeklyLabel: 'next',
  });
  return {
    to: recipient.email,
    subject: personalize(edited.subject.replace(eventTime.subjectTime, recipientTime.subjectTime), recipient),
    body: personalize(edited.body.replace(eventTime.bodyTime, recipientTime.bodyTime), recipient),
  };
};

interface DraftInput {
  to: string;
  subject: string;
  body: string;
}

export const getMailtoUrl = ({ to, subject, body }: DraftInput) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const getGmailComposeUrl = ({ to, subject, body }: DraftInput) => {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body });
  return `https://mail.google.com/mail/?${params.toString()}`;
};

// Outlook on the web for work and school accounts (Northwestern mail is Microsoft 365).
export const getOutlookComposeUrl = ({ to, subject, body }: DraftInput) => {
  const params = new URLSearchParams({ to, subject, body });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
};

export type MailService = 'gmail' | 'outlook' | 'default';

// A web page can't see which mail apps are installed: mailto opens whatever the system's
// default is, which on Apple devices is Apple Mail unless someone changed it.
export const getMailServiceName = (service: MailService, isAppleDevice: boolean) => {
  if (service === 'gmail') return 'Gmail';
  if (service === 'outlook') return 'Outlook';
  return isAppleDevice ? 'Apple Mail' : 'Default mail app';
};

export const getComposeUrl = (service: MailService, draft: DraftInput) => {
  if (service === 'gmail') return getGmailComposeUrl(draft);
  if (service === 'outlook') return getOutlookComposeUrl(draft);
  return getMailtoUrl(draft);
};
