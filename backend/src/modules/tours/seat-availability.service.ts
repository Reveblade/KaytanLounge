import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { seatLabels } from '../fleet/seat-map';
import type { VehicleDocument } from '../fleet/vehicle.schema';
import { ACTIVE_BOOKING_STATUSES, Booking } from '../bookings/booking.schema';
import type { TourDocument } from './schemas/tour.schema';

export interface SeatAvailability {
  seatCount: number;
  seatsLeft: number;
  /** Labels not purchasable right now: booked, held, or blocked by the operator. */
  unavailableSeats: string[];
  bookedSeats: string[];
  pendingApprovals: number;
}

/** Seat state for a departure, derived from live bookings rather than stored counters. */
@Injectable()
export class SeatAvailabilityService {
  constructor(@InjectModel(Booking.name) private readonly bookings: Model<Booking>) {}

  async forTour(tour: TourDocument, vehicle: VehicleDocument): Promise<SeatAvailability> {
    const map = await this.forTours([tour], new Map([[String(vehicle._id), vehicle]]));
    return map.get(String(tour._id))!;
  }

  async forTours(tours: TourDocument[], vehicles: Map<string, VehicleDocument>): Promise<Map<string, SeatAvailability>> {
    const result = new Map<string, SeatAvailability>();
    if (!tours.length) return result;
    const now = new Date();
    const active = await this.bookings
      .find({
        tourId: { $in: tours.map((t) => t._id) },
        status: { $in: ACTIVE_BOOKING_STATUSES },
        $or: [{ status: 'CONFIRMED' }, { holdExpiresAt: { $exists: false } }, { holdExpiresAt: { $gt: now } }],
      })
      .select('tourId status passengers.seatLabel')
      .lean();

    const bookedByTour = new Map<string, string[]>();
    const pendingByTour = new Map<string, number>();
    for (const booking of active) {
      const key = String(booking.tourId);
      const list = bookedByTour.get(key) ?? [];
      list.push(...booking.passengers.map((p) => p.seatLabel));
      bookedByTour.set(key, list);
      if (booking.status === 'AWAITING_APPROVAL') pendingByTour.set(key, (pendingByTour.get(key) ?? 0) + 1);
    }

    for (const tour of tours) {
      const vehicle = vehicles.get(String(tour.vehicleId));
      const allSeats = vehicle ? seatLabels(vehicle.seatMap) : [];
      const booked = bookedByTour.get(String(tour._id)) ?? [];
      const blocked = new Set(tour.blockedSeats);
      const unavailable = new Set([...booked, ...blocked]);
      const sellable = allSeats.filter((s) => !blocked.has(s));
      result.set(String(tour._id), {
        seatCount: sellable.length,
        seatsLeft: Math.max(0, sellable.filter((s) => !unavailable.has(s)).length),
        unavailableSeats: allSeats.filter((s) => unavailable.has(s)),
        bookedSeats: booked,
        pendingApprovals: pendingByTour.get(String(tour._id)) ?? 0,
      });
    }
    return result;
  }

  bookedSeatIds(tourId: Types.ObjectId) {
    return this.bookings.find({ tourId, status: { $in: ACTIVE_BOOKING_STATUSES } }).select('_id').lean();
  }
}
