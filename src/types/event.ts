// What the organizer fills in when creating or editing an event.
export interface EventDetails {
  title: string;
  description: string;
  location: string;
  // Weekdays are abstract weekly availability; dates use the selected calendar range.
  scheduleMode?: 'dates' | 'weekdays';
  weekdays?: number[];
  // Date polls can choose a span or pick independent calendar days.
  dateSelectionMode?: 'range' | 'multiple';
  startDate: string;
  endDate: string;
  // Individual dates removed from the range; older events have none.
  excludedDates?: string[];
  // "HH:MM", 30-minute steps; endTime may be "24:00" for midnight.
  startTime: string;
  endTime: string;
  invitees: string[];
  // IANA zone the event happens in; every date and time on it is wall-clock time there.
  timeZone: string;
}

// The meeting time the organizer settled on, in the event's own time zone.
export interface ConfirmedTime {
  date: string;
  // Minutes after midnight.
  start: number;
  end: number;
}

export interface ScheduledEvent extends EventDetails {
  code: string;
  createdAt: string;
  // Whoever created the event (an anonymous Firebase user, or this device when running locally).
  ownerId: string;
  // ISO expiry: one week after the last date, or one year after a weekly poll's creation.
  expiresAt: string;
  confirmedTime: ConfirmedTime | null;
  // Participant name -> slot keys ("YYYY-MM-DD|minutes") they are free.
  responses: Record<string, string[]>;
}

// An email a participant left so the organizer can send them the confirmed time.
// Stored apart from the event so only the organizer can read it.
export interface EventContact {
  name: string;
  email: string;
  // A participant's chosen display zone; absent means the event's zone.
  timeZone?: string;
}

// A time a participant proposes when none of the event's times work for them.
// Stored apart from the event so only the organizer can read it.
export interface TimeSuggestion {
  id: string;
  name: string;
  date: string;
  // Minutes after midnight, in the event's time zone.
  start: number;
  end: number;
  note: string;
  createdAt: string;
}

export type NewTimeSuggestion = Omit<TimeSuggestion, 'id' | 'createdAt'>;

// An event someone opened as a participant, for "Events you joined" on the home page.
export interface JoinedEvent {
  code: string;
  // The name they last responded as, if they've responded.
  name: string;
  lastVisited: string;
}

// Who's using Goodtime: everyone has an anonymous identity; signing in with Google is optional
// and lets the same events follow them to other devices.
export interface Account {
  isSignedIn: boolean;
  name: string;
  email: string;
}
