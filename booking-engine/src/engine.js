// NONSTOP AI Booking Engine MVP — pure, dry-run planning module.
// No network requests, persistence, or live message delivery.
const HOUR = 60 * 60 * 1000;
export const DEFAULT_REMINDER_HOURS = [24, 2];

export function parseCalendarEvent(event, { tenantId, calendarId, timeZone = 'Europe/London' }) {
  if (!tenantId || !calendarId) throw new Error('tenantId and calendarId required');
  if (!event?.id) throw new Error('Calendar event id required');
  const startRaw = event.start?.dateTime;
  if (!startRaw) return null; // Skip all-day events.
  const startMs = Date.parse(startRaw);
  if (!Number.isFinite(startMs)) throw new Error('Invalid start time');
  const endMs = Date.parse(event.end?.dateTime ?? '');
  if (!Number.isFinite(endMs) || endMs <= startMs) throw new Error('Invalid end time');
  return {
    tenantId, calendarId, eventId: event.id,
    version: event.etag ?? event.updated ?? String(startMs),
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    timeZone,
    status: event.status === 'cancelled' ? 'cancelled' : 'confirmed',
    // No guest details are inferred. Consent/contact is configured separately.
  };
}

export function planAppointmentMessages(appointment, {
  now = new Date(),
  reminderHours = DEFAULT_REMINDER_HOURS,
  contactApproved = false,
  channel = 'dry-run',
} = {}) {
  if (!appointment?.tenantId || !appointment.eventId) throw new Error('Invalid appointment');
  if (appointment.status === 'cancelled') return [];
  if (!contactApproved) return []; // Explicit approval required before planning delivery.
  const nowMs = new Date(now).getTime();
  const startMs = Date.parse(appointment.startAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(startMs)) throw new Error('Invalid time');
  if (startMs <= nowMs) return [];
  const uniqueHours = [...new Set(reminderHours)];
  if (uniqueHours.some(h => !Number.isFinite(h) || h <= 0)) throw new Error('Invalid reminder hours');
  const messages = [];
  for (const hours of uniqueHours) {
    const dueMs = startMs - hours * HOUR;
    if (dueMs <= nowMs) continue;
    const kind = `reminder_${hours}h`;
    messages.push({
      tenantId: appointment.tenantId,
      calendarId: appointment.calendarId,
      eventId: appointment.eventId,
      version: appointment.version,
      kind,
      channel,
      dueAt: new Date(dueMs).toISOString(),
      // A changed event version invalidates old scheduled work.
      idempotencyKey: [appointment.tenantId, appointment.calendarId, appointment.eventId, appointment.version, kind, channel].map(encodeURIComponent).join(':'),
      status: 'planned',
    });
  }
  return messages.sort((a,b) => a.dueAt.localeCompare(b.dueAt));
}

export function shouldDispatch(message, currentAppointment, { now = new Date(), contactApproved = false } = {}) {
  if (!contactApproved || !currentAppointment || currentAppointment.status !== 'confirmed') return false;
  if (message.tenantId !== currentAppointment.tenantId || message.calendarId !== currentAppointment.calendarId || message.eventId !== currentAppointment.eventId) return false;
  if (message.version !== currentAppointment.version) return false;
  return Number.isFinite(Date.parse(message.dueAt)) && Date.parse(message.dueAt) <= new Date(now).getTime() && Date.parse(currentAppointment.startAt) > new Date(now).getTime();
}

// Read-only Google Calendar REST adapter. Token supplied at runtime, never committed.
// This is not connected to a live Google account in the MVP.
export async function listGoogleCalendarEvents({ accessToken, calendarId = 'primary', timeMin, timeMax, fetchImpl = fetch }) {
  if (!accessToken) throw new Error('Google OAuth access token required');
  if (!timeMin || !timeMax || Date.parse(timeMax) <= Date.parse(timeMin)) throw new Error('Valid time range required');
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('showDeleted', 'true');
  url.searchParams.set('fields', 'nextPageToken,items(id,etag,updated,status,start(dateTime,date),end(dateTime,date))');
  url.searchParams.set('maxResults', '250');
  const results = [];
  const seenPageTokens = new Set();
  let pageToken;
  do {
    if (pageToken) {
      if (seenPageTokens.has(pageToken)) throw new Error('Google Calendar pagination repeated a token');
      seenPageTokens.add(pageToken);
      url.searchParams.set('pageToken', pageToken);
    }
    const response = await fetchImpl(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Google Calendar API failed: HTTP ${response.status}`);
    const data = await response.json();
    if (!data || (data.items !== undefined && !Array.isArray(data.items))) {
      throw new Error('Invalid Google Calendar response');
    }
    results.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return results;
}
