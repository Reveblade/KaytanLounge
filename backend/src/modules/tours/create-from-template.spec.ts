import { ConflictActionException } from '../../common/exceptions/domain.exception';
import { TourService } from './tour.service';
import type { CreateFromTemplateDto } from './dto/tour.dto';

/**
 * Rolling a template out over a season is one call over many dates. A guide or vehicle
 * that is already busy on one of those dates must not take the whole batch down and
 * leave half a month created with nothing said about it.
 */
describe('TourService.createFromTemplate', () => {
  const template = {
    _id: 'tpl',
    guideId: 'guide-1',
    vehicleId: 'vehicle-1',
    defaultStartTime: '09:00',
  };

  function service(create: jest.Mock): TourService {
    const instance = Object.create(TourService.prototype) as TourService;
    Object.assign(instance, {
      getTemplate: jest.fn().mockResolvedValue(template),
      templateCore: jest.fn().mockReturnValue({ routeId: 'route-1' }),
      create,
    });
    return instance;
  }

  const dto = (dates: string[]): CreateFromTemplateDto => ({ templateId: 'tpl', dates });

  it('creates one departure per date', async () => {
    const create = jest.fn().mockImplementation((_actor, input: { startsAt: string }) => Promise.resolve({ _id: input.startsAt }));
    const result = await service(create).createFromTemplate(undefined, dto(['2026-09-01', '2026-09-08', '2026-09-15']));

    expect(result.created).toHaveLength(3);
    expect(result.skipped).toEqual([]);
  });

  it('skips a clashing date, reports it, and still creates the rest', async () => {
    const create = jest.fn().mockImplementation((_actor, input: { startsAt: string }) => {
      if (input.startsAt.startsWith('2026-09-08')) {
        return Promise.reject(new ConflictActionException('SCHEDULE_CONFLICT', 'The guide is already on another departure at that time'));
      }
      return Promise.resolve({ _id: input.startsAt });
    });

    const result = await service(create).createFromTemplate(undefined, dto(['2026-09-01', '2026-09-08', '2026-09-15']));

    expect(result.created).toHaveLength(2);
    expect(result.skipped).toEqual([{ date: '2026-09-08', reason: 'The guide is already on another departure at that time' }]);
    // The date after the clash still ran: one busy day must not end the batch.
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('lets a genuine fault through rather than reporting it as a busy day', async () => {
    const create = jest.fn().mockRejectedValue(new Error('database is down'));

    await expect(service(create).createFromTemplate(undefined, dto(['2026-09-01', '2026-09-08']))).rejects.toThrow('database is down');
    // It stopped at the first real failure instead of hammering every remaining date.
    expect(create).toHaveBeenCalledTimes(1);
  });
});
