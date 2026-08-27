import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { addDays, startOfIstanbulDay } from '../../common/utils/time';
import type { DashboardDto } from '../../contract/api';
import { SettingsService } from '../settings/settings.module';
import { Tour } from '../tours/schemas/tour.schema';
import { SeatAvailabilityService } from '../tours/seat-availability.service';
import { TourService } from '../tours/tour.service';
import { Booking } from './booking.schema';
import { BookingService } from './booking.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Tour.name) private readonly tours: Model<Tour>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    private readonly tourService: TourService,
    private readonly bookingService: BookingService,
    private readonly availability: SeatAvailabilityService,
    private readonly settings: SettingsService,
  ) {}

  async summary(): Promise<DashboardDto> {
    const now = new Date();
    const dayStart = startOfIstanbulDay(now);
    const dayEnd = addDays(dayStart, 1);
    const weekEnd = addDays(dayStart, 7);
    const monthAgo = addDays(now, -30);
    const settings = await this.settings.get();

    const [todayTours, weekTours, pendingAgg, revenueAgg, recent] = await Promise.all([
      this.tours.find({ startsAt: { $gte: dayStart, $lt: dayEnd }, status: { $in: ['PUBLISHED', 'COMPLETED'] } }),
      this.tours.find({ startsAt: { $gte: dayStart, $lt: weekEnd }, status: 'PUBLISHED' }).sort({ startsAt: 1 }),
      this.bookings.aggregate<{ _id: string; count: number; amount: number }>([
        { $match: { status: 'AWAITING_APPROVAL' } },
        { $group: { _id: '$currency', count: { $sum: 1 }, amount: { $sum: '$total' } } },
      ]),
      this.bookings.aggregate<{ _id: string; amount: number }>([
        { $match: { 'payment.status': 'PAID', 'payment.approvedAt': { $gte: monthAgo } } },
        { $group: { _id: '$currency', amount: { $sum: '$total' } } },
      ]),
      this.bookings.find().sort({ createdAt: -1 }).limit(8),
    ]);

    const todayIds = todayTours.map((t) => t._id);
    const todayBookings = todayIds.length
      ? await this.bookings.find({ tourId: { $in: todayIds }, status: 'CONFIRMED' }).select('passengers').lean()
      : [];
    const passengers = todayBookings.reduce((s, b) => s + b.passengers.length, 0);
    const checkedIn = todayBookings.reduce((s, b) => s + b.passengers.filter((p) => p.checkedInAt).length, 0);

    const relations = await this.tourService.loadRelations(weekTours);
    const avail = await this.availability.forTours(weekTours, relations.vehicles);
    const seatsTotal = weekTours.reduce((s, t) => s + (avail.get(String(t._id))?.seatCount ?? 0), 0);
    const seatsSold = weekTours.reduce((s, t) => s + (avail.get(String(t._id))?.bookedSeats.length ?? 0), 0);

    const currency = settings.defaultCurrency;
    const pending = pendingAgg.find((p) => p._id === currency) ?? pendingAgg[0];
    const revenue = revenueAgg.find((r) => r._id === currency) ?? revenueAgg[0];

    return {
      today: { tours: todayTours.length, passengers, checkedIn },
      pending: {
        approvals: pendingAgg.reduce((s, p) => s + p.count, 0),
        awaitingAmount: { amount: pending?.amount ?? 0, currency: (pending?._id as DashboardDto['revenue30d']['currency']) ?? currency },
      },
      next7Days: { tours: weekTours.length, seatsSold, seatsTotal },
      revenue30d: { amount: revenue?.amount ?? 0, currency: (revenue?._id as DashboardDto['revenue30d']['currency']) ?? currency },
      recentBookings: await this.bookingService.details(recent),
      upcomingTours: weekTours.slice(0, 8).map((t) => this.tourService.toListItem(t, relations, avail.get(String(t._id)))),
    };
  }
}
