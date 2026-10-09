// What the organizer fills in when creating or editing an event.
export interface EventDetails {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
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
  confirmedTime: ConfirmedTime | null;
  // Participant name -> slot keys ("YYYY-MM-DD|minutes") they are free.
  responses: Record<string, string[]>;
}

// An email a participant left so the organizer can send them the confirmed time.
// Stored apart from the event so only the organizer can read it.
export interface EventContact {
  name: string;
  email: string;
}
