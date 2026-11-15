import test from 'node:test';
import assert from 'node:assert/strict';
import { dryRunCalendarSummaries, PILOT } from './src/calendar-pilot.js';

const event = {
  id: PILOT.eventId,
  start: PILOT.start,
  end: PILOT.end,
  status: 'confirmed',
};

test('known calendar event yields 24-hour and 2-hour proposed reminders', () => {
  const report = dryRunCalendarSummaries([event], { now: '2026-11-15T09:00:00Z' });
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.persisted, false);
  assert.equal(report.sent, false);
  assert.equal(report.appointments.length, 1);
  assert.deepEqual(report.proposedReminders.map(m => m.dueAt), [
    '2026-11-15T10:00:00.000Z',
    '2026-11-16T08:00:00.000Z',
  ]);
  assert.ok(report.proposedReminders.every(m => m.channel === 'dry-run'));
});

test('cancelled event does not schedule reminders', () => {
  const report = dryRunCalendarSummaries([{ ...event, status: 'cancelled' }], { now: '2026-11-15T09:00:00Z' });
  assert.equal(report.proposedReminders.length, 0);
});

test('past due reminders are not recreated', () => {
  const report = dryRunCalendarSummaries([event], { now: '2026-11-15T11:00:00Z' });
  assert.deepEqual(report.proposedReminders.map(m => m.kind), ['reminder_2h']);
});

test('no customer details are carried into appointment records', () => {
  const report = dryRunCalendarSummaries([{ ...event, description: 'customer private details', attendees: [{ email: 'private@example.com' }] }], { now: '2026-11-15T09:00:00Z' });
  assert.equal(JSON.stringify(report).includes('private@example.com'), false);
  assert.equal(JSON.stringify(report).includes('customer private details'), false);
});
