import test from 'node:test';
import assert from 'node:assert/strict';
import { syncCalendarDryRun } from './src/sync-calendar.js';

test('reads Google events and calls only dry-run Supabase RPC', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url.startsWith('https://www.googleapis.com/')) {
      return { ok: true, json: async () => ({ items: [{
        id: 'synthetic-id', etag: 'version-1', status: 'confirmed',
        start: { dateTime: '2026-12-01T10:00:00Z' },
        end: { dateTime: '2026-12-01T10:30:00Z' },
        attendees: [{ email: 'private@example.com' }],
      }] }) };
    }
    return { ok: true, json: async () => ({ mode: 'dry-run', new_reminders: 2 }) };
  };
  const report = await syncCalendarDryRun({
    googleAccessToken: 'synthetic-google-token',
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'synthetic-supabase-key',
    timeMin: '2026-11-30T00:00:00Z',
    timeMax: '2026-12-02T00:00:00Z',
    fetchImpl,
  });
  assert.equal(report.sent, false);
  assert.equal(report.processed, 1);
  assert.equal(requests.length, 2);
  assert.match(requests[1].url, /\/rest\/v1\/rpc\/br_sync_test_event$/);
  const body = JSON.parse(requests[1].options.body);
  assert.equal(body.p_event_id, 'synthetic-id');
  assert.equal(JSON.stringify(body).includes('private@example.com'), false);
});

test('refuses other tenants and missing credentials', async () => {
  await assert.rejects(() => syncCalendarDryRun({}), /credentials/);
  await assert.rejects(() => syncCalendarDryRun({
    googleAccessToken: 'x', supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'x', calendarId: 'some-other-calendar',
  }), /locked/);
});
