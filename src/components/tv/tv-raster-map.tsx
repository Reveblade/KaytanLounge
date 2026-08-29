import type { GeoJsonLineString } from "@/lib/contract/api";

interface Node {
  id: string;
  location: { lat: number; lng: number };
}

const TILE = 256;
const MAX_TILES = 28;

/**
 * A real map that is just OpenStreetMap images and an SVG. It is in the HTML
 * the server sends, so a television that never runs our JavaScript still sees
 * the city. No third-party key — Carto's free dark tiles now watermark.
 */
export function TvRasterMap({ path, nodes }: { path?: GeoJsonLineString; nodes: Node[] }) {
  const points = collect(path, nodes);
  const grid = plan(points);
  const line = (path?.coordinates?.length ? path.coordinates : points).map(([lng, lat]) => project(lng, lat, grid));
  const pins = nodes.map((node) => ({ id: node.id, ...project(node.location.lng, node.location.lat, grid) }));
  const vb = `${grid.x0 * TILE} ${grid.y0 * TILE} ${grid.cols * TILE} ${grid.rows * TILE}`;
  const tiles: { key: string; src: string }[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const x = grid.x0 + col;
      const y = grid.y0 + row;
      tiles.push({ key: `${grid.z}-${x}-${y}`, src: `/tv-map/${grid.z}/${x}/${y}` });
    }
  }

  return (
    <div className="tv-raster" style={{ ["--tv-cols" as string]: String(grid.cols) }}>
      <div className="tv-raster-board">
        {tiles.map((tile) => (
          // Native img: next/image is a client optimizer a lounge set never runs.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={tile.key} src={tile.src} alt="" width={TILE} height={TILE} decoding="async" draggable={false} />
        ))}
        <svg className="tv-raster-ink" viewBox={vb} preserveAspectRatio="none">
          {line.length > 1 ? (
            <polyline
              points={line.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#ffa07a"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.92"
            />
          ) : null}
          {pins.map((pin) => (
            <circle key={pin.id} cx={pin.x} cy={pin.y} r="11" fill="#ffa07a" stroke="#0e0e11" strokeWidth="4" />
          ))}
        </svg>
      </div>
    </div>
  );
}

function collect(path: GeoJsonLineString | undefined, nodes: Node[]): [number, number][] {
  if (path?.coordinates?.length) return path.coordinates;
  return nodes.map((node) => [node.location.lng, node.location.lat]);
}

function lon2tile(lon: number, z: number) {
  return ((lon + 180) / 360) * 2 ** z;
}

function lat2tile(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
}

function project(lng: number, lat: number, grid: Grid) {
  return { x: lon2tile(lng, grid.z) * TILE, y: lat2tile(lat, grid.z) * TILE };
}

interface Grid {
  z: number;
  x0: number;
  y0: number;
  cols: number;
  rows: number;
}

function plan(points: [number, number][]): Grid {
  const pts = points.length ? points : ([[28.98, 41.03]] as [number, number][]);
  for (let z = 13; z >= 10; z--) {
    const grid = fit(pts, z);
    if (grid.cols * grid.rows <= MAX_TILES) return grid;
  }
  return fit([[28.98, 41.03]], 11);
}

function fit(points: [number, number][], z: number): Grid {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lng, lat] of points) {
    const x = lon2tile(lng, z);
    const y = lat2tile(lat, z);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const pad = points.length < 2 ? 1.4 : 0.7;
  const extent = 2 ** z;
  let x0 = clamp(Math.floor(minX - pad), 0, extent - 1);
  let y0 = clamp(Math.floor(minY - pad), 0, extent - 1);
  let x1 = clamp(Math.ceil(maxX + pad), x0 + 1, extent);
  let y1 = clamp(Math.ceil(maxY + pad), y0 + 1, extent);
  while (x1 - x0 < 4 && x0 > 0) x0 -= 1;
  while (x1 - x0 < 4 && x1 < extent) x1 += 1;
  while (y1 - y0 < 3 && y0 > 0) y0 -= 1;
  while (y1 - y0 < 3 && y1 < extent) y1 += 1;
  return { z, x0, y0, cols: x1 - x0, rows: y1 - y0 };
}

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value;
}
