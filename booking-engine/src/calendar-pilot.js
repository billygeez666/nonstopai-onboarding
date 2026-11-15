import { parseCalendarEvent, planAppointmentMessages } from './engine.js';

// Adapter for the event summary shape returned by the connected Calendar service.
// Does not import descriptions, attendees, contact details or calendar credentials.
export function fromCalendarSummary(event) {
  if (!event?.id || !event.start || !event.end) throw new Error('Missing event fields');
  return {
    id: event.id,
    status: event.status ?? 'confirmed',
    updated: event.updated ?? `${event.start}|${event.end}|${event.status ?? 'confirmed'}`,
    start: { dateTime: event.start },
    end: { dateTime: event.end },
  };
}

// An explicit synthetic fixture is safe for local integration tests.
export const PILOT = Object.freeze({
  tenantId: 'nonstopai-internal-test',
  calendarId: 'aibookingsystems@gmail.com',
  eventId: '7lhjp43mgskbjaeo79b77oasp0',
  start: '2026-11-16T10:00:00Z',
  end: '2026-11-16T10:30:00Z',
});

// Returns a dry-run report, not a queue write or delivery instruction.
export function dryRunCalendarSummaries(events, { now = new Date(), tenantId = PILOT.tenantId, calendarId = PILOT.calendarId } = {}) {
  const appointments = [];
  const proposedReminders = [];
  for (const event of events) {
    const appointment = parseCalendarEvent(fromCalendarSummary(event), { tenantId, calendarId });
    if (!appointment) continue;
    appointments.push(appointment);
    // contactApproved is set only to demonstrate potential scheduling; channel remains dry-run.
    // It is NOT permission to send a real customer message.
    proposedReminders.push(...planAppointmentMessages(appointment, { now, contactApproved: true, channel: 'dry-run' }));
  }
  return { mode: 'dry-run', calendarId, appointments, proposedReminders, persisted: false, sent: false };
}
