import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendarEvent, planAppointmentMessages, shouldDispatch, listGoogleCalendarEvents } from './src/engine.js';

const event = { id: 'evt-1', etag: 'v1', status: 'confirmed', start: { dateTime: '2026-12-01T10:00:00+00:00' }, end: { dateTime: '2026-12-01T11:00:00+00:00' } };
const options = { tenantId: 'garage-1', calendarId: 'primary' };
const now = '2026-11-29T09:00:00Z';

test('calendar event is normalized without importing guest PII', () => {
  const a = parseCalendarEvent({ ...event, attendees: [{ email: 'private@example.com' }] }, options);
  assert.equal(a.startAt, '2026-12-01T10:00:00.000Z');
  assert.equal(JSON.stringify(a).includes('private@example.com'), false);
});

test('requires explicit contact approval', () => {
  const a = parseCalendarEvent(event, options);
  assert.deepEqual(planAppointmentMessages(a, { now }), []);
});

test('plans two reminders with unique keys and deterministic due times', () => {
  const a = parseCalendarEvent(event, options);
  const m = planAppointmentMessages(a, { now, contactApproved: true });
  assert.equal(m.length, 2);
  assert.equal(m[0].dueAt, '2026-11-30T10:00:00.000Z');
  assert.equal(m[1].dueAt, '2026-12-01T08:00:00.000Z');
  assert.notEqual(m[0].idempotencyKey, m[1].idempotencyKey);
});

test('cancelled and all-day events are skipped', () => {
  const a = parseCalendarEvent({ ...event, status: 'cancelled' }, options);
  assert.deepEqual(planAppointmentMessages(a, { now, contactApproved: true }), []);
  assert.equal(parseCalendarEvent({ id: 'all-day', start: { date: '2026-12-01' } }, options), null);
});

test('old event version never dispatches after reschedule', () => {
  const a = parseCalendarEvent(event, options);
  const [m] = planAppointmentMessages(a, { now, contactApproved: true });
  const changed = { ...a, version: 'v2' };
  assert.equal(shouldDispatch(m, changed, { now: '2026-11-30T10:00:00Z', contactApproved: true }), false);
  assert.equal(shouldDispatch(m, a, { now: '2026-11-30T10:00:00Z', contactApproved: true }), true);
});

test('Google adapter reads pages using injected transport, without sending messages', async () => {
  let calls = 0;
  const fetchImpl = async (_url, opts) => {
    calls++;
    assert.match(opts.headers.Authorization, /^Bearer /);
    return { ok: true, json: async () => calls === 1 ? { items: [event], nextPageToken: 'page2' } : { items: [] } };
  };
  const items = await listGoogleCalendarEvents({ accessToken: 'test-only', timeMin: '2026-11-01T00:00:00Z', timeMax: '2026-12-02T00:00:00Z', fetchImpl });
  assert.equal(calls, 2);
  assert.equal(items.length, 1);
});
