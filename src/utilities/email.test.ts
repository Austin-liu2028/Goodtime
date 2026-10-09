import { describe, expect, it } from 'vitest';
import {
  buildConfirmationEmail,
  getComposeUrl,
  getGmailComposeUrl,
  getMailServiceName,
  getMailtoUrl,
  isValidEmail,
  personalize,
  uniqueRecipients,
} from './email';

const input = {
  title: 'Design review',
  description: 'Bring your laptop.',
  location: 'Mudd 3514',
  timeZone: 'America/Chicago',
  confirmedTime: { date: '2026-10-06', start: 780, end: 930 },
  organizerName: 'Nate',
  eventLink: 'https://goodtime.example/e/K7MQ2P',
};

describe('buildConfirmationEmail', () => {
  it('fills a friendly template from the event details', () => {
    const { subject, body } = buildConfirmationEmail(input);
    expect(subject).toBe('Meeting time confirmed: Design review on Tue, Oct 6, 1:00 – 3:30 PM (Central Time)');
    expect(body).toMatch(/^Hi \{name\},\n\nThank you for sharing your availability!/);
    expect(body).toContain('Time: Tuesday, October 6, 1:00 – 3:30 PM (Central Time)\nAddress: Mudd 3514\n\n');
    expect(body).not.toContain('People:');
    expect(body).toContain('A note from Nate:\nBring your laptop.');
    expect(body).toContain('from the event page:\nhttps://goodtime.example/e/K7MQ2P');
    expect(body).toMatch(/Best,\nNate$/);
  });

  it('leaves out lines the organizer had nothing for', () => {
    const { body } = buildConfirmationEmail({ ...input, description: '', location: '', organizerName: '' });
    expect(body).not.toContain('Address:');
    expect(body).not.toContain('A note from');
    expect(body).toMatch(/Looking forward to seeing you there!$/);
  });

  it('addresses each copy to its own recipient only', () => {
    const { body } = buildConfirmationEmail(input);
    const forAlex = personalize(body, { name: 'Alex', email: 'alex@u.edu' });
    expect(forAlex).toMatch(/^Hi Alex,/);
    expect(forAlex).not.toContain('{name}');
    expect(personalize('Hi {name},', { name: '', email: 'sam@u.edu' })).toBe('Hi sam@u.edu,');
  });
});

describe('recipients', () => {
  it('accepts real-looking addresses only', () => {
    expect(isValidEmail(' a@b.co ')).toBe(true);
    expect(isValidEmail('jordan@school')).toBe(false);
  });

  it('keeps the first entry for an address, so a known name wins', () => {
    expect(uniqueRecipients([
      { name: 'Alex', email: 'Alex@u.edu' },
      { name: '', email: 'alex@U.edu' },
    ])).toEqual([{ name: 'Alex', email: 'Alex@u.edu' }]);
  });
});

describe('drafts', () => {
  const draft = { to: 'a@b.co', subject: 'Hi & bye', body: 'Line 1\nLine 2' };

  it('opens a mail app draft to one person', () => {
    expect(getMailtoUrl(draft)).toBe('mailto:a%40b.co?subject=Hi%20%26%20bye&body=Line%201%0ALine%202');
  });

  it('opens a Gmail compose window with the same draft', () => {
    const url = new URL(getGmailComposeUrl(draft));
    expect(url.searchParams.get('to')).toBe('a@b.co');
    expect(url.searchParams.get('su')).toBe('Hi & bye');
    expect(url.searchParams.get('body')).toBe('Line 1\nLine 2');
  });

  it('opens Outlook on the web for school and work accounts', () => {
    const url = new URL(getComposeUrl('outlook', draft));
    expect(url.origin + url.pathname).toBe('https://outlook.office.com/mail/deeplink/compose');
    expect(url.searchParams.get('to')).toBe('a@b.co');
    expect(url.searchParams.get('subject')).toBe('Hi & bye');
  });

  it('calls the system mail app Apple Mail only on Apple devices', () => {
    expect(getComposeUrl('default', draft)).toMatch(/^mailto:/);
    expect(getMailServiceName('default', true)).toBe('Apple Mail');
    expect(getMailServiceName('default', false)).toBe('Default mail app');
  });
});
