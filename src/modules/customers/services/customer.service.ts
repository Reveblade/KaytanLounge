import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EntityNotFoundException } from '../../../common/exceptions/domain.exception';
import { containsRegex, iso, toObjectId } from '../../../common/utils/mongo';
import { LOCALES, type CustomerDto, type Locale, type Paginated } from '../../../contract/api';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import type { KuwhoProfile, KuwhoSession } from './kuwho.client';

@Injectable()
export class CustomerService {
  constructor(@InjectModel(Customer.name) private readonly customers: Model<Customer>) {}

  async getById(id: string): Promise<CustomerDocument> {
    const customer = await this.customers.findById(toObjectId(id, 'customerId'));
    if (!customer) throw new EntityNotFoundException('Customer', id);
    return customer;
  }

  async findByIds(ids: (string | Types.ObjectId)[]): Promise<Map<string, CustomerDocument>> {
    const docs = await this.customers.find({ _id: { $in: ids.map((i) => new Types.ObjectId(String(i))) } });
    return new Map(docs.map((d) => [String(d._id), d]));
  }

  async list(query: { page?: number; pageSize?: number; q?: string }): Promise<Paginated<CustomerDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const filter = query.q
      ? {
          $or: [
            { displayName: containsRegex(query.q) },
            { phone: containsRegex(query.q) },
            { email: containsRegex(query.q) },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.customers.find(filter).sort({ lastSeenAt: -1, createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      this.customers.countDocuments(filter),
    ]);
    return { items: items.map((c) => this.toDto(c)), total, page, pageSize };
  }

  /** Called on every sign-in: keeps the mirror aligned with what Kuwho just asserted. */
  async upsertFromKuwho(session: KuwhoSession, profile?: KuwhoProfile): Promise<CustomerDocument> {
    const source = profile ?? session.customer;
    const locale = (profile?.preferredLocale ?? 'en') as Locale;
    const update = {
      displayName: source.displayName,
      firstName: source.firstName,
      lastName: source.lastName,
      phone: source.phone,
      phoneVerified: source.phoneVerified,
      email: source.email,
      emailVerified: source.emailVerified,
      avatarUrl: profile?.avatar?.url,
      preferredLocale: LOCALES.includes(locale) ? locale : 'en',
      lastSeenAt: new Date(),
    };
    return this.customers.findOneAndUpdate(
      { kuwhoCustomerId: session.customer.id },
      { $set: update, $setOnInsert: { kuwhoCustomerId: session.customer.id } },
      { upsert: true, new: true },
    );
  }

  async applyProfile(customer: CustomerDocument, profile: KuwhoProfile): Promise<CustomerDocument> {
    customer.displayName = profile.displayName;
    customer.firstName = profile.firstName;
    customer.lastName = profile.lastName;
    customer.phone = profile.phone;
    customer.phoneVerified = profile.phoneVerified;
    customer.email = profile.email;
    customer.emailVerified = profile.emailVerified;
    customer.avatarUrl = profile.avatar?.url;
    const locale = profile.preferredLocale as Locale;
    if (LOCALES.includes(locale)) customer.preferredLocale = locale;
    return customer.save();
  }

  async touch(id: string): Promise<void> {
    await this.customers.updateOne({ _id: new Types.ObjectId(id) }, { $set: { lastSeenAt: new Date() } });
  }

  async updateNotes(id: string, notes: string | undefined): Promise<CustomerDocument> {
    const customer = await this.getById(id);
    customer.adminNotes = notes;
    return customer.save();
  }

  /** Seed and walk-in helper: a customer record that is not (yet) backed by Kuwho. */
  async ensureLocal(input: { kuwhoCustomerId: string; displayName: string; phone?: string; email?: string; locale?: Locale }): Promise<CustomerDocument> {
    return this.customers.findOneAndUpdate(
      { kuwhoCustomerId: input.kuwhoCustomerId },
      {
        $setOnInsert: {
          kuwhoCustomerId: input.kuwhoCustomerId,
          displayName: input.displayName,
          phone: input.phone,
          email: input.email,
          phoneVerified: Boolean(input.phone),
          emailVerified: Boolean(input.email),
          preferredLocale: input.locale ?? 'en',
        },
      },
      { upsert: true, new: true },
    );
  }

  toDto(customer: CustomerDocument, extra?: { bookingsCount?: number; adminNotes?: boolean }): CustomerDto & { adminNotes?: string } {
    return {
      id: String(customer._id),
      kuwhoCustomerId: customer.kuwhoCustomerId,
      displayName: customer.displayName,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      phoneVerified: customer.phoneVerified,
      email: customer.email,
      emailVerified: customer.emailVerified,
      avatarUrl: customer.avatarUrl,
      preferredLocale: customer.preferredLocale,
      bookingsCount: extra?.bookingsCount,
      lastSeenAt: iso(customer.lastSeenAt),
      createdAt: customer.createdAt.toISOString(),
      ...(extra?.adminNotes ? { adminNotes: customer.adminNotes } : {}),
    };
  }
}
