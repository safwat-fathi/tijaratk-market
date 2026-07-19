import { BadRequestException, Injectable } from '@nestjs/common';

export const DELIVERY_TIME_ZONE = 'Africa/Cairo';
const LEGACY_SLOT_MINUTES = 60;
const MIN_WINDOW_MINUTES = 60;
const SCHEDULE_STEP_MINUTES = 15;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type DeliverySlot = {
  date: string;
  starts_at: string;
  ends_at: string;
};

export type DeliverySlotInput = Pick<DeliverySlot, 'date' | 'starts_at'> & {
  ends_at?: string;
};

export type DeliveryWindowConstraints = {
  date: string;
  min_starts_at: string;
  max_ends_at: string;
  step_minutes: typeof SCHEDULE_STEP_MINUTES;
  min_duration_minutes: typeof MIN_WINDOW_MINUTES;
};

export type DeliveryOperatingHours = {
  delivery_available?: boolean;
  delivery_starts_at: string | null;
  delivery_ends_at: string | null;
};

export type DeliveryAvailabilityOptions = {
  allowAlwaysOpenWithoutHours?: boolean;
};

export type DeliveryAvailability = {
  timezone: typeof DELIVERY_TIME_ZONE;
  state: 'open' | 'closed' | 'unavailable';
  ordering_mode: 'asap' | 'scheduled' | 'unavailable';
  operating_hours: { starts_at: string | null; ends_at: string | null };
  schedule_constraints: DeliveryWindowConstraints | null;
  slots: DeliverySlot[];
};

export type TrustedDeliverySchedule = {
  date: Date;
  date_key: string;
  starts_at: string;
  ends_at: string;
  snapshot: string;
};

@Injectable()
export class DeliverySchedulingService {
  hasValidOperatingHours(hours: DeliveryOperatingHours) {
    const startsAt = hours.delivery_starts_at?.trim();
    const endsAt = hours.delivery_ends_at?.trim();
    if (
      !startsAt ||
      !endsAt ||
      !TIME_PATTERN.test(startsAt) ||
      !TIME_PATTERN.test(endsAt)
    ) {
      return false;
    }
    return (
      this.toMinutes(endsAt) - this.toMinutes(startsAt) >= MIN_WINDOW_MINUTES
    );
  }

  getAvailability(
    hours: DeliveryOperatingHours,
    now = new Date(),
    options: DeliveryAvailabilityOptions = {},
  ): DeliveryAvailability {
    if (hours.delivery_available === false) {
      return {
        timezone: DELIVERY_TIME_ZONE,
        state: 'unavailable',
        ordering_mode: 'unavailable',
        operating_hours: {
          starts_at: hours.delivery_starts_at,
          ends_at: hours.delivery_ends_at,
        },
        schedule_constraints: null,
        slots: [],
      };
    }
    if (
      options.allowAlwaysOpenWithoutHours &&
      !hours.delivery_starts_at &&
      !hours.delivery_ends_at
    ) {
      return {
        timezone: DELIVERY_TIME_ZONE,
        state: 'open',
        ordering_mode: 'asap',
        operating_hours: { starts_at: null, ends_at: null },
        schedule_constraints: null,
        slots: [],
      };
    }
    const { startsAt, endsAt } = this.requireOperatingHours(hours);
    const cairo = this.getCairoParts(now);
    const opensAt = this.toMinutes(startsAt);
    const closesAt = this.toMinutes(endsAt);
    const currentMinutes = cairo.hour * 60 + cairo.minute;
    const isOpen = currentMinutes >= opensAt && currentMinutes < closesAt;
    const scheduledDateOffset = currentMinutes < opensAt ? 0 : 1;
    const scheduledDate = this.addDays(cairo.dateKey, scheduledDateOffset);

    return {
      timezone: DELIVERY_TIME_ZONE,
      state: isOpen ? 'open' : 'closed',
      ordering_mode: isOpen ? 'asap' : 'scheduled',
      operating_hours: { starts_at: startsAt, ends_at: endsAt },
      schedule_constraints: isOpen
        ? null
        : {
            date: scheduledDate,
            min_starts_at: startsAt,
            max_ends_at: endsAt,
            step_minutes: SCHEDULE_STEP_MINUTES,
            min_duration_minutes: MIN_WINDOW_MINUTES,
          },
      slots: isOpen
        ? []
        : this.buildSlots(scheduledDate, opensAt, closesAt),
    };
  }

  validateSelection(
    hours: DeliveryOperatingHours,
    input?: DeliverySlotInput,
    now = new Date(),
    options: DeliveryAvailabilityOptions = {},
  ): TrustedDeliverySchedule | null {
    const availability = this.getAvailability(hours, now, options);
    if (availability.state === 'unavailable') {
      throw new BadRequestException('التوصيل غير متاح حالياً.');
    }
    if (availability.state === 'open') {
      if (input) {
        throw new BadRequestException(
          'المتجر مفتوح الآن؛ أرسل الطلب للتوصيل الفوري دون موعد مجدول.',
        );
      }
      return null;
    }
    if (!input) {
      throw new BadRequestException(
        'اختر موعد توصيل متاحاً لإرسال الطلب خارج ساعات العمل.',
      );
    }

    const constraints = availability.schedule_constraints;
    if (!constraints || input.date !== constraints.date) {
      throw new BadRequestException(
        'موعد التوصيل المختار لم يعد متاحاً. اختر موعداً آخر.',
      );
    }

    const startsAt = input.starts_at?.trim();
    const requestedEndsAt = input.ends_at?.trim();
    if (
      !startsAt ||
      !TIME_PATTERN.test(startsAt) ||
      (requestedEndsAt !== undefined && !TIME_PATTERN.test(requestedEndsAt))
    ) {
      throw new BadRequestException('اكتب وقت بداية ونهاية صالحين.');
    }

    const startsAtMinutes = this.toMinutes(startsAt);
    const endsAt =
      requestedEndsAt ??
      this.fromMinutes(startsAtMinutes + constraints.min_duration_minutes);
    const endsAtMinutes = this.toMinutes(endsAt);
    if (
      startsAtMinutes % constraints.step_minutes !== 0 ||
      endsAtMinutes % constraints.step_minutes !== 0
    ) {
      throw new BadRequestException('يجب اختيار الوقت بفواصل 15 دقيقة.');
    }
    if (endsAtMinutes <= startsAtMinutes) {
      throw new BadRequestException(
        'وقت النهاية يجب أن يكون بعد وقت البداية في نفس اليوم.',
      );
    }
    if (endsAtMinutes - startsAtMinutes < constraints.min_duration_minutes) {
      throw new BadRequestException(
        'مدة التوصيل المطلوبة يجب ألا تقل عن ساعة.',
      );
    }
    if (
      startsAtMinutes < this.toMinutes(constraints.min_starts_at) ||
      endsAtMinutes > this.toMinutes(constraints.max_ends_at)
    ) {
      throw new BadRequestException(
        'موعد التوصيل يجب أن يكون بالكامل داخل ساعات عمل المتجر.',
      );
    }

    return {
      date: new Date(`${constraints.date}T00:00:00.000Z`),
      date_key: constraints.date,
      starts_at: startsAt,
      ends_at: endsAt,
      snapshot: `${this.formatDate(constraints.date)} · من ${this.formatTime(startsAt)} إلى ${this.formatTime(endsAt)}`,
    };
  }

  private buildSlots(
    date: string,
    opensAt: number,
    closesAt: number,
  ): DeliverySlot[] {
    const slots: DeliverySlot[] = [];
    for (
      let startsAt = opensAt;
      startsAt + LEGACY_SLOT_MINUTES <= closesAt;
      startsAt += LEGACY_SLOT_MINUTES
    ) {
      slots.push({
        date,
        starts_at: this.fromMinutes(startsAt),
        ends_at: this.fromMinutes(startsAt + LEGACY_SLOT_MINUTES),
      });
    }
    return slots;
  }

  private requireOperatingHours(hours: DeliveryOperatingHours) {
    const startsAt = hours.delivery_starts_at?.trim();
    const endsAt = hours.delivery_ends_at?.trim();
    if (!startsAt || !endsAt || !this.hasValidOperatingHours(hours)) {
      throw new BadRequestException('ساعات التوصيل غير صالحة أو غير مكتملة.');
    }
    return { startsAt, endsAt };
  }

  private getCairoParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: DELIVERY_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const read = (type: string) =>
      parts.find((part) => part.type === type)?.value;
    const year = read('year');
    const month = read('month');
    const day = read('day');
    const hour = Number(read('hour'));
    const minute = Number(read('minute'));
    if (
      !year ||
      !month ||
      !day ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute)
    ) {
      throw new Error('Failed to resolve Cairo time');
    }
    return { dateKey: `${year}-${month}-${day}`, hour, minute };
  }

  private addDays(dateKey: string, offset: number) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + offset))
      .toISOString()
      .slice(0, 10);
  }

  private toMinutes(value: string) {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private fromMinutes(value: number) {
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private formatTime(value: string) {
    const [hourValue, minutes] = value.split(':');
    const hour = Number(hourValue);
    return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'مساءً' : 'صباحاً'}`;
  }

  private formatDate(value: string) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
}
