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

test('reconciles verified timestamp-less cancellations and ignores untracked tombstones', async () => {
  const writes = [];
  const fetchImpl = async (url, options) => {
    const target = new URL(url);
    if (target.hostname === 'www.googleapis.com') {
      assert.equal(target.searchParams.get('showDeleted'), 'true');
      assert.equal(target.searchParams.get('singleEvents'), 'true');
      return { ok: true, json: async () => ({ items: [
        { id: 'tracked', status: 'cancelled' },
        { id: 'unknown', status: 'cancelled' },
      ] }) };
    }
    if (target.pathname.endsWith('/br_appointments')) {
      assert.equal(target.searchParams.get('br_tenants.slug'), 'eq.nonstopai-internal-test');
      const rows = target.searchParams.get('external_event_id') === 'eq.tracked'
        ? [{ start_at: '2026-12-01T10:00:00Z', end_at: '2026-12-01T10:30:00Z' }]
        : [];
      return { ok: true, json: async () => rows };
    }
    writes.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ mode: 'dry-run' }) };
  };

  await syncCalendarDryRun({
    googleAccessToken: 'test', supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'test', fetchImpl,
    timeMin: '2026-11-30T00:00:00Z', timeMax: '2026-12-02T00:00:00Z',
  });
  assert.deepEqual(writes, [{
    p_event_id: 'tracked', p_version: 'cancelled',
    p_start: '2026-12-01T10:00:00.000Z', p_end: '2026-12-01T10:30:00.000Z',
    p_status: 'cancelled',
  }]);
});

test('Google failure surfaces only the status and makes no Supabase calls', async () => {
  const fetchImpl = async (url) => {
    assert.equal(new URL(url).hostname, 'www.googleapis.com');
    return { ok: false, status: 503, json: async () => assert.fail('Unexpected error body read') };
  };
  await assert.rejects(() => syncCalendarDryRun({
    googleAccessToken: 'test', supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'test', fetchImpl,
    timeMin: '2026-11-30T00:00:00Z', timeMax: '2026-12-02T00:00:00Z',
  }), { message: 'Google Calendar API failed: HTTP 503' });
});
