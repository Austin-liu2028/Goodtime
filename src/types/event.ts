// What the organizer fills in when creating an event.
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
}

export interface ScheduledEvent extends EventDetails {
  code: string;
  createdAt: string;
  // Participant name -> slot keys ("YYYY-MM-DD|minutes") they are free.
  responses: Record<string, string[]>;
}
