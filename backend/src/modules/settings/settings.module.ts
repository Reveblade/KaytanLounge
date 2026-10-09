import { Body, Controller, Get, Injectable, Module, Patch } from '@nestjs/common';
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { HydratedDocument, Model } from 'mongoose';
import { CurrentActor, Realms, RequirePermissions, type RequestActor } from '../../common/auth/auth.decorators';
import { LocalizedTextDto } from '../../common/dto/common.dto';
import { LocalizedTextDocument, LocalizedTextSchema } from '../../common/schema/shared.schema';
import { PAYMENT_PROVIDERS, type CurrencyCode, type PaymentProvider, type SettingsDto } from '../../contract/api';
import { AuditModule } from '../audit/audit.module';
import { AuditService } from '../audit/audit.service';

// -------------------------------------------------------------------------------- Schema

@Schema({ _id: false })
class PaymentProviderSettingDocument {
  @Prop({ type: String, enum: PAYMENT_PROVIDERS, required: true }) provider!: PaymentProvider;
  @Prop({ type: Boolean, default: true }) enabled!: boolean;
  @Prop({ type: LocalizedTextSchema, default: {} }) label!: LocalizedTextDocument;
  @Prop({ type: LocalizedTextSchema }) instructions?: LocalizedTextDocument;
}
const PaymentProviderSettingSchema = SchemaFactory.createForClass(PaymentProviderSettingDocument);

@Schema({ collection: 'settings', timestamps: true })
export class Settings {
  @Prop({ type: String, default: 'global', unique: true }) key!: string;
  @Prop({ type: String, default: 'Başka İstanbul Yok' }) brandName!: string;
  @Prop({ type: LocalizedTextSchema, default: {} }) tagline!: LocalizedTextDocument;
  @Prop({ type: String }) phone?: string;
  @Prop({ type: String }) whatsapp?: string;
  @Prop({ type: String }) email?: string;
  @Prop({ type: String }) address?: string;
  @Prop({ type: String }) instagram?: string;
  @Prop({ type: String }) facebook?: string;
  @Prop({ type: String }) youtube?: string;
  @Prop({ type: String }) tiktok?: string;
  @Prop({ type: String, enum: ['TRY', 'EUR', 'USD', 'GBP'], default: 'EUR' }) defaultCurrency!: CurrencyCode;
  @Prop({ type: [PaymentProviderSettingSchema], default: [] }) paymentProviders!: PaymentProviderSettingDocument[];
  @Prop({ type: String }) bankIban?: string;
  @Prop({ type: String }) bankHolder?: string;
  @Prop({ type: String }) bankName?: string;
  @Prop({ type: Number, default: 30 }) holdMinutes!: number;
  @Prop({ type: Number, default: 24 }) approvalHours!: number;
  @Prop({ type: [String], default: [] }) featuredRouteSlugs!: string[];
  updatedAt!: Date;
}
export type SettingsDocument = HydratedDocument<Settings>;
export const SettingsSchema = SchemaFactory.createForClass(Settings);

// ---------------------------------------------------------------------------------- DTOs

class PaymentProviderSettingDto {
  @IsIn(PAYMENT_PROVIDERS) provider!: PaymentProvider;
  @IsBoolean() enabled!: boolean;
  @ValidateNested() @Type(() => LocalizedTextDto) label!: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) instructions?: LocalizedTextDto;
}

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(80) brandName?: string;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) tagline?: LocalizedTextDto;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsString() @MaxLength(32) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(120) instagram?: string;
  @IsOptional() @IsString() @MaxLength(120) facebook?: string;
  @IsOptional() @IsString() @MaxLength(120) youtube?: string;
  @IsOptional() @IsString() @MaxLength(120) tiktok?: string;
  @IsOptional() @IsIn(['TRY', 'EUR', 'USD', 'GBP']) defaultCurrency?: CurrencyCode;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentProviderSettingDto) paymentProviders?: PaymentProviderSettingDto[];
  @IsOptional() @IsString() @MaxLength(40) bankIban?: string;
  @IsOptional() @IsString() @MaxLength(120) bankHolder?: string;
  @IsOptional() @IsString() @MaxLength(120) bankName?: string;
  @IsOptional() @IsInt() @Min(5) @Max(1440) holdMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(240) approvalHours?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) featuredRouteSlugs?: string[];
}

// ------------------------------------------------------------------------------- Service

/**
 * The three the checkout offers, in the order it offers them. AT_VENUE stays in the
 * enum for walk-ins an admin records by hand, but it is not a choice to put in front
 * of a customer, so it ships off.
 */
const DEFAULT_PROVIDERS: PaymentProviderSettingDocument[] = [
  { provider: 'IYZICO', enabled: true, label: { tr: 'Online kart (iyzico)', en: 'Online card (iyzico)' }, instructions: { tr: 'Kart ödemesi yakında otomatik onaylanacak. Şimdilik ekibimiz sizi arayıp ödemeyi tamamlar.', en: 'Card checkout goes live soon. For now our team calls you to complete the payment.' } },
  { provider: 'STRIPE', enabled: true, label: { tr: 'Online kart (Stripe)', en: 'Online card (Stripe)' }, instructions: { tr: 'Kart ödemesi yakında otomatik onaylanacak. Şimdilik ekibimiz sizi arayıp ödemeyi tamamlar.', en: 'Card checkout goes live soon. For now our team calls you to complete the payment.' } },
  { provider: 'BANK_TRANSFER', enabled: true, label: { tr: 'Bizi arayın (havale / EFT)', en: 'Call us (transfer / EFT)' }, instructions: { tr: 'Toplam tutarı aşağıdaki hesaba gönderin ve açıklamaya bilet kodunuzu yazın.', en: 'Send the total to the account below and quote your ticket code as the reference.' } },
  { provider: 'AT_VENUE', enabled: false, label: { tr: 'Kaytan Lounge\'da ödeme', en: 'Pay at Kaytan Lounge' }, instructions: { tr: 'Turdan önce Kaytan Lounge resepsiyonunda ödeyebilirsiniz. Koltuklarınız 24 saat rezerve kalır.', en: 'Pay at the Kaytan Lounge front desk before the tour. Your seats stay reserved for 24 hours.' } },
];

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name) private readonly settings: Model<Settings>,
    private readonly audit: AuditService,
  ) {}

  async document(): Promise<SettingsDocument> {
    const existing = await this.settings.findOne({ key: 'global' });
    if (existing) return existing;
    return this.settings.create({ key: 'global', paymentProviders: DEFAULT_PROVIDERS, tagline: { tr: 'Şehri bir günde, bir rota ile.', en: 'The whole city, one route, one day.' } });
  }

  async get(): Promise<SettingsDto> {
    return this.toDto(await this.document());
  }

  async update(actor: RequestActor | undefined, dto: UpdateSettingsDto): Promise<SettingsDto> {
    const doc = await this.document();
    Object.assign(doc, dto);
    await doc.save();
    await this.audit.record(actor, 'settings.update', 'settings', 'global', undefined, { fields: Object.keys(dto) });
    return this.toDto(doc);
  }

  toDto(doc: SettingsDocument): SettingsDto {
    return {
      brand: { name: doc.brandName, tagline: doc.tagline ?? {} },
      contact: {
        phone: doc.phone,
        whatsapp: doc.whatsapp,
        email: doc.email,
        address: doc.address,
        instagram: doc.instagram,
        facebook: doc.facebook,
        youtube: doc.youtube,
        tiktok: doc.tiktok,
      },
      defaultCurrency: doc.defaultCurrency,
      payments: {
        providers: (doc.paymentProviders.length ? doc.paymentProviders : DEFAULT_PROVIDERS).map((p) => ({
          provider: p.provider,
          enabled: p.enabled,
          mode: 'manual',
          label: p.label ?? {},
          instructions: p.instructions,
        })),
        bankTransfer: { iban: doc.bankIban, holder: doc.bankHolder, bank: doc.bankName },
      },
      booking: { holdMinutes: doc.holdMinutes, approvalHours: doc.approvalHours },
      featuredRouteSlugs: doc.featuredRouteSlugs,
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------- Controller

@ApiTags('admin/settings')
@Controller('admin/settings')
@Realms('ADMIN')
class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions('SETTINGS_READ')
  get() {
    return this.settings.get();
  }

  @Patch()
  @RequirePermissions('SETTINGS_WRITE')
  update(@CurrentActor() actor: RequestActor, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(actor, dto);
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: Settings.name, schema: SettingsSchema }]), AuditModule],
  controllers: [AdminSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
