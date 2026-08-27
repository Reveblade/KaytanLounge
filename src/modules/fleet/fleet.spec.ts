import { model, Schema } from 'mongoose';
import { seatMapToDto } from './fleet.module';
import { generateSeatMap, premiumSeatLabels, seatLabels, validateSeatMap } from './seat-map';
import { SeatMapSchema, type SeatMapDocument } from './vehicle.schema';

describe('generateSeatMap', () => {
  it('lays out a 2+2 coach with an aisle and a full back row', () => {
    const map = generateSeatMap({ rows: 3, layout: [2, 2], fullBackRow: true, withDriverRow: true });
    expect(map.cols).toBe(5);
    // 1 driver row + 3 seat rows
    expect(map.rows).toBe(4);
    // 2 rows of 4 + a back row of 5
    expect(seatLabels(map)).toEqual(['1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D', '3A', '3B', '3C', '3D', '3E']);
    expect(map.cells.filter((c) => c.kind === 'DRIVER')).toHaveLength(1);
    expect(map.cells.filter((c) => c.kind === 'GUIDE')).toHaveLength(1);
  });

  it('marks the requested number of front rows premium', () => {
    const map = generateSeatMap({ rows: 4, layout: [1, 2], premiumRows: 2, withDriverRow: true });
    expect([...premiumSeatLabels(map)].sort()).toEqual(['1A', '1B', '1C', '2A', '2B', '2C']);
  });

  it('rejects a duplicated seat label', () => {
    const map = generateSeatMap({ rows: 2, layout: [1, 1], withDriverRow: false });
    const seats = map.cells.filter((c) => c.kind === 'SEAT');
    expect(seats.length).toBeGreaterThan(1);
    seats[1].label = seats[0].label;
    expect(() => validateSeatMap(map)).toThrow(/used twice/);
  });

  it('rejects a seat with no label', () => {
    const map = generateSeatMap({ rows: 2, layout: [1, 1], withDriverRow: false });
    map.cells.find((c) => c.kind === 'SEAT')!.label = undefined;
    expect(() => validateSeatMap(map)).toThrow(/no label/);
  });

  it('rejects two cells in the same position', () => {
    const map = generateSeatMap({ rows: 2, layout: [1, 1], withDriverRow: false });
    map.cells.push({ ...map.cells[0], label: 'ZZ' });
    expect(() => validateSeatMap(map)).toThrow(/defined twice/);
  });
});

describe('seatMapToDto', () => {
  /**
   * Mongoose subdocuments do not spread. This test pins the mapping so the seat plan
   * never reaches the client as document internals again.
   */
  it('returns plain cells from a hydrated document', () => {
    const Holder = model('SeatMapHolder', new Schema({ seatMap: SeatMapSchema }));
    const generated = generateSeatMap({ rows: 2, layout: [1, 1], premiumRows: 1, withDriverRow: true });
    const doc = new Holder({ seatMap: generated });
    const dto = seatMapToDto(doc.seatMap as unknown as SeatMapDocument);

    expect(dto.rows).toBe(generated.rows);
    expect(dto.cols).toBe(generated.cols);
    expect(dto.cells).toHaveLength(generated.cells.length);
    expect(seatLabels(dto)).toEqual(['1A', '1B', '2A', '2B']);
    expect(dto.cells.find((c) => c.label === '1A')?.premium).toBe(true);
    // No Mongoose internals leaked onto the wire shape.
    for (const cell of dto.cells) {
      expect(Object.keys(cell).every((k) => ['row', 'col', 'kind', 'label', 'premium'].includes(k))).toBe(true);
    }
    expect(JSON.parse(JSON.stringify(dto)).cells[0]).toEqual(dto.cells[0]);
  });
});
