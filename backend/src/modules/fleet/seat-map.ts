import { DomainException } from '../../common/exceptions/domain.exception';
import type { SeatCell, SeatMap } from '../../contract/api';

const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface GenerateSeatMapOptions {
  rows: number;
  /** Seats per row on the left and right of the aisle, e.g. [2, 2] or [2, 1]. */
  layout: [number, number];
  /** Fill the last row across the aisle (typical coach back row). */
  fullBackRow?: boolean;
  /** Mark the first N rows premium. */
  premiumRows?: number;
  withDriverRow?: boolean;
}

/** A coach-style grid: driver + guide up front, an aisle in the middle, letters across. */
export function generateSeatMap(options: GenerateSeatMapOptions): SeatMap {
  const [left, right] = options.layout;
  const cols = left + 1 + right;
  const cells: SeatCell[] = [];
  let row = 0;
  if (options.withDriverRow) {
    cells.push({ row: 0, col: 0, kind: 'DRIVER' });
    for (let c = 1; c < cols - 1; c += 1) cells.push({ row: 0, col: c, kind: 'EMPTY' });
    cells.push({ row: 0, col: cols - 1, kind: 'GUIDE' });
    row = 1;
  }
  for (let r = 0; r < options.rows; r += 1, row += 1) {
    const isLast = r === options.rows - 1;
    const premium = (options.premiumRows ?? 0) > r;
    let letter = 0;
    for (let c = 0; c < cols; c += 1) {
      const isAisle = c === left;
      if (isAisle && !(isLast && options.fullBackRow)) {
        cells.push({ row, col: c, kind: 'AISLE' });
        continue;
      }
      cells.push({ row, col: c, kind: 'SEAT', label: `${r + 1}${ROW_LETTERS[letter]}`, premium });
      letter += 1;
    }
  }
  return { rows: row, cols, cells };
}

export function seatLabels(map: SeatMap): string[] {
  return map.cells.filter((c) => c.kind === 'SEAT' && c.label).map((c) => c.label!);
}

export function premiumSeatLabels(map: SeatMap): Set<string> {
  return new Set(map.cells.filter((c) => c.kind === 'SEAT' && c.premium && c.label).map((c) => c.label!));
}

/** Rejects overlapping cells, seats without labels and duplicate labels. */
export function validateSeatMap(map: SeatMap): void {
  const positions = new Set<string>();
  const labels = new Set<string>();
  for (const cell of map.cells) {
    if (cell.row < 0 || cell.col < 0 || cell.row >= map.rows || cell.col >= map.cols) {
      throw new DomainException('SEAT_MAP_INVALID', `Cell ${cell.row},${cell.col} is outside the grid`);
    }
    const key = `${cell.row}:${cell.col}`;
    if (positions.has(key)) throw new DomainException('SEAT_MAP_INVALID', `Cell ${key} is defined twice`);
    positions.add(key);
    if (cell.kind === 'SEAT') {
      if (!cell.label?.trim()) throw new DomainException('SEAT_MAP_INVALID', `Seat at ${key} has no label`);
      if (labels.has(cell.label)) throw new DomainException('SEAT_MAP_INVALID', `Seat label ${cell.label} is used twice`);
      labels.add(cell.label);
    }
  }
  if (labels.size === 0) throw new DomainException('SEAT_MAP_INVALID', 'A vehicle needs at least one seat');
}
