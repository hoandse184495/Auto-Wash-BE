import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAvailableSlotsForShift } from './bookingService.js';

test('buildAvailableSlotsForShift creates slots from a branch working window', () => {
  const shift = {
    ShiftName: 'Giờ làm việc chi nhánh',
    StartTime: new Date('1970-01-01T08:00:00.000Z'),
    EndTime: new Date('1970-01-01T08:30:00.000Z'),
  };

  const slots = buildAvailableSlotsForShift({
    shift,
    count: 2,
    bookingDate: new Date('2026-07-08T00:00:00.000Z'),
    slotDuration: 30,
    buffer: 5,
    bookedPerTime: {},
    now: new Date('2026-07-08T00:00:00.000Z'),
  });

  assert.deepEqual(slots.map((slot) => slot.StartTime), ['08:00']);
  assert.equal(slots[0].StaffCount, 2);
  assert.equal(slots[0].Available, 2);
});
