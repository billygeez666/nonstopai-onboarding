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
  const results = [];
  for (const event of events) {
    // Google returns cancelled event tombstones with incomplete time data.
    // Do not infer a cancellation or delete appointments from missing events.
    if (!event.start?.dateTime || !event.end?.dateTime) {
      results.push({ eventId: event.id, skipped: 'no-timed-start-end' });
      continue;
    }
    const appointment = parseCalendarEvent(event, { tenantId, calendarId });
    const url = new URL('/rest/v1/rpc/br_sync_test_event', origin);
    const response = await fetchImpl(url.toString(), {
      method: 'POST',
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': 'application/json',
      },
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
