import { BadRequestException } from '@nestjs/common';
import { DeliverySchedulingService } from './delivery-scheduling.service';

describe('DeliverySchedulingService', () => {
  const service = new DeliverySchedulingService();
  const hours = {
    delivery_starts_at: '09:00',
    delivery_ends_at: '22:00',
  };

  it('uses Cairo time for the merchant 07:00, 09:00, and 22:00 boundaries', () => {
    const atSeven = new Date('2026-07-19T04:00:00.000Z');
    const atNine = new Date('2026-07-19T06:00:00.000Z');
    const atTwentyTwo = new Date('2026-07-19T19:00:00.000Z');

    const beforeOpening = service.getAvailability(hours, atSeven);
    expect(beforeOpening.ordering_mode).toBe('scheduled');
    expect(beforeOpening.schedule_constraints).toEqual({
      date: '2026-07-19',
      min_starts_at: '09:00',
      max_ends_at: '22:00',
      step_minutes: 15,
      min_duration_minutes: 60,
    });
    expect(new Set(beforeOpening.slots.map((slot) => slot.date))).toEqual(
      new Set(['2026-07-19']),
    );
    expect(service.getAvailability(hours, atNine)).toMatchObject({
      ordering_mode: 'asap',
      schedule_constraints: null,
    });
    const afterClosing = service.getAvailability(hours, atTwentyTwo);
    expect(afterClosing.ordering_mode).toBe('scheduled');
    expect(new Set(afterClosing.slots.map((slot) => slot.date))).toEqual(
      new Set(['2026-07-20']),
    );
  });

  it('keeps merchants without configured hours open all day', () => {
    const availability = service.getAvailability(
      {
        delivery_available: true,
        delivery_starts_at: null,
        delivery_ends_at: null,
      },
      new Date('2026-07-19T04:00:00.000Z'),
      { allowAlwaysOpenWithoutHours: true },
    );

    expect(availability).toMatchObject({
      state: 'open',
      ordering_mode: 'asap',
      operating_hours: { starts_at: null, ends_at: null },
      schedule_constraints: null,
      slots: [],
    });
  });

  it('does not offer slots when delivery is disabled', () => {
    const availability = service.getAvailability({
      delivery_available: false,
      ...hours,
    });

    expect(availability).toMatchObject({
      state: 'unavailable',
      ordering_mode: 'unavailable',
      schedule_constraints: null,
      slots: [],
    });
  });

  it('requires a window of at least one hour, allowing cross-day', () => {
    expect(
      service.hasValidOperatingHours({
        delivery_starts_at: '09:00',
        delivery_ends_at: '09:59',
      }),
    ).toBe(false);
    expect(
      service.hasValidOperatingHours({
        delivery_starts_at: '09:00',
        delivery_ends_at: '10:00',
      }),
    ).toBe(true);
    expect(
      service.hasValidOperatingHours({
        delivery_starts_at: '22:00',
        delivery_ends_at: '09:00',
      }),
    ).toBe(true);
  });

  it('allows immediate orders at opening and rejects a scheduled slot', () => {
    const now = new Date('2026-07-19T06:00:00.000Z'); // 09:00 Cairo
    expect(service.getAvailability(hours, now).ordering_mode).toBe('asap');
    expect(() =>
      service.validateSelection(
        hours,
        { date: '2026-07-19', starts_at: '10:00' },
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('requires scheduling at closing and exposes tomorrow only', () => {
    const now = new Date('2026-07-19T19:00:00.000Z'); // 22:00 Cairo
    const availability = service.getAvailability(hours, now);
    expect(availability.ordering_mode).toBe('scheduled');
    expect(new Set(availability.slots.map((slot) => slot.date))).toEqual(
      new Set(['2026-07-20']),
    );
    expect(availability.slots[0]).toEqual({
      date: '2026-07-20',
      starts_at: '09:00',
      ends_at: '10:00',
    });
    expect(() => service.validateSelection(hours, undefined, now)).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.validateSelection(
        hours,
        { date: '2026-07-21', starts_at: '09:00' },
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('rolls the next available date across month and year boundaries', () => {
    const monthEnd = service.getAvailability(
      hours,
      new Date('2026-07-31T19:00:00.000Z'), // 22:00 Cairo
    );
    const yearEnd = service.getAvailability(
      hours,
      new Date('2026-12-31T20:00:00.000Z'), // 22:00 Cairo
    );

    expect(monthEnd.slots[0]?.date).toBe('2026-08-01');
    expect(yearEnd.slots[0]?.date).toBe('2027-01-01');
  });

  it('keeps start-only checkout compatible by deriving a one-hour end', () => {
    const now = new Date('2026-07-19T05:00:00.000Z'); // 08:00 Cairo
    const trusted = service.validateSelection(
      hours,
      { date: '2026-07-19', starts_at: '09:15' },
      now,
    );
    expect(trusted).toMatchObject({
      date_key: '2026-07-19',
      starts_at: '09:15',
      ends_at: '10:15',
    });
  });

  it.each([
    ['09:15', '10:15'],
    ['09:15', '12:30'],
    ['09:00', '22:00'],
  ])('accepts the flexible window %s–%s before opening', (startsAt, endsAt) => {
    const now = new Date('2026-07-19T05:00:00.000Z'); // 08:00 Cairo
    expect(
      service.validateSelection(
        hours,
        {
          date: '2026-07-19',
          starts_at: startsAt,
          ends_at: endsAt,
        },
        now,
      ),
    ).toMatchObject({
      date_key: '2026-07-19',
      starts_at: startsAt,
      ends_at: endsAt,
    });
  });

  it.each([
    ['09:10', '10:15'],
    ['09:15', '10:10'],
    ['09:00', '09:45'],
    ['10:00', '09:00'],
    ['08:45', '10:00'],
    ['21:30', '22:15'],
    ['', '10:00'],
    ['not-a-time', '10:00'],
    ['09:00', 'not-a-time'],
  ])('rejects the invalid flexible window %s–%s', (startsAt, endsAt) => {
    const now = new Date('2026-07-19T05:00:00.000Z'); // 08:00 Cairo
    expect(() =>
      service.validateSelection(
        hours,
        {
          date: '2026-07-19',
          starts_at: startsAt,
          ends_at: endsAt,
        },
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a valid range submitted for a stale date', () => {
    const now = new Date('2026-07-19T05:00:00.000Z'); // 08:00 Cairo
    expect(() =>
      service.validateSelection(
        hours,
        {
          date: '2026-07-20',
          starts_at: '09:00',
          ends_at: '10:00',
        },
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects today after closing when tomorrow is the next available date', () => {
    const now = new Date('2026-07-19T19:00:00.000Z'); // 22:00 Cairo
    expect(() =>
      service.validateSelection(
        hours,
        {
          date: '2026-07-19',
          starts_at: '09:00',
          ends_at: '10:00',
        },
        now,
      ),
    ).toThrow(BadRequestException);
  });
});
