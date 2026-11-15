import { listGoogleCalendarEvents, parseCalendarEvent } from './engine.js';

// Server-side only. Never bundle into a browser app or expose service-role keys.
// Explicitly dry-run: no customer details, no messaging provider, no calendar writes.
export async function syncCalendarDryRun({
  googleAccessToken,
  supabaseUrl,
  supabaseServiceRoleKey,
  calendarId = 'aibookingsystems@gmail.com',
  tenantId = 'nonstopai-internal-test',
  timeMin,
  timeMax,
  fetchImpl = fetch,
}) {
  if (!googleAccessToken || !supabaseUrl || !supabaseServiceRoleKey) throw new Error('Server-side credentials required');
  const origin = new URL(supabaseUrl);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Supabase URL must be an HTTPS origin');
  }
  if (calendarId !== 'aibookingsystems@gmail.com' || tenantId !== 'nonstopai-internal-test') {
    throw new Error('Pilot calendar and tenant are locked');
  }
  const events = await listGoogleCalendarEvents({
    accessToken: googleAccessToken, calendarId, timeMin, timeMax, fetchImpl,
  });
  const headers = {
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`,
    'Content-Type': 'application/json',
  };
  const results = [];
  for (let event of events) {
    // A verified cancellation may contain only an event ID. Resolve its last
    // known times from the isolated pilot, and ignore unknown cancellations.
    if (event.status === 'cancelled' && (!event.start?.dateTime || !event.end?.dateTime)) {
      if (!event.id) throw new Error('Cancellation event identity missing');
      const lookup = new URL('/rest/v1/br_appointments', origin);
      lookup.search = new URLSearchParams({
        select: 'start_at,end_at,br_tenants!inner(slug)',
        calendar_id: `eq.${calendarId}`,
        external_event_id: `eq.${event.id}`,
        'br_tenants.slug': `eq.${tenantId}`,
        limit: '2',
      }).toString();
      const response = await fetchImpl(lookup.toString(), { headers, redirect: 'error' });
      if (!response.ok) throw new Error(`Dry-run appointment lookup failed: HTTP ${response.status}`);
      const appointments = await response.json();
      if (!Array.isArray(appointments) || appointments.length > 1) throw new Error('Invalid dry-run appointment lookup');
      if (!appointments.length) {
        results.push({ eventId: event.id, skipped: 'untracked-cancellation' });
        continue;
      }
      const [previous] = appointments;
      event = {
        ...event,
        etag: event.etag ?? event.updated ?? 'cancelled',
        start: { dateTime: previous.start_at },
        end: { dateTime: previous.end_at },
      };
    }
    if (!event.start?.dateTime || !event.end?.dateTime) {
      results.push({ eventId: event.id, skipped: 'no-timed-start-end' });
      continue;
    }
    const appointment = parseCalendarEvent(event, { tenantId, calendarId });
    const url = new URL('/rest/v1/rpc/br_sync_test_event', origin);
    const response = await fetchImpl(url.toString(), {
      method: 'POST',
      headers,
      redirect: 'error',
      body: JSON.stringify({
        p_event_id: appointment.eventId,
        p_version: appointment.version,
        p_start: appointment.startAt,
        p_end: appointment.endAt,
        p_status: appointment.status,
      }),
    });
    if (!response.ok) throw new Error(`Dry-run database sync failed: HTTP ${response.status}`);
    const result = await response.json();
    results.push({ eventId: appointment.eventId, result });
  }
  return { mode: 'dry-run', calendarId, processed: results.length, results, sent: false };
}
