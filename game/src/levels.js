// The three levels of MOTHLIGHT, as tile maps plus the data the world needs.
// Map legend, one character per 40px tile:
//   #  wall — blocks movement and sight
//   .  floor — lit, ordinary
//   d  shadow — dark floor; detection rises half as fast here
//   C  crate — solid cover; blocks movement and sight
//   B  bush — walkable cover; you are hidden inside unless a guard is close
//   P  where the moth starts
//   L  loot — a golden moth to collect
//   E  the exit — reach it unseen
// Guard waypoints and the safe route (used by the screenshot autopilot) are
// tile coordinates [col, row]. Guards walk between waypoints along a
// breadth-first path, so a patrol never needs a straight clear line.
import { COLS, ROWS, TILE } from './config.js';

export const LEVELS = [
  {
    name: '1 · The Moth Gallery',
    subtitle: 'A museum after closing. Two guards, five moths, one quiet door.',
    map: [
      '################################',
      '#P.....C......d.......C.....L..#',
      '#......C......d.......C........#',
      '#..B..........C..........C.....#',
      '#..B.....d..............C......#',
      '#..B.....d....C................#',
      '#........d.........B..B........#',
      '#..C......d...####..B..B.......#',
      '#.............#..#.............#',
      '#..L.....C....#..#.....d.......#',
      '#....................C..d......#',
      '#..B......d...####....C........#',
      '#..B......d...#..#.............#',
      '#......C......#..#.....L.......#',
      '#..C..........####....C........#',
      '#.............d........C..E....#',
      '#..L....B....d.....C...........#',
      '#.......B....d.....C......L....#',
      '#....C.......d.................#',
      '################################',
    ],
    guards: [
      { waypoints: [[5, 4], [20, 4], [20, 8], [5, 8]], pause: 0.9 },
      { waypoints: [[24, 10], [24, 16], [12, 16], [12, 10]], pause: 0.7 },
      { waypoints: [[28, 6], [28, 12]], pause: 1.1 },
    ],
    route: [[1, 1], [1, 9], [3, 9], [1, 12], [1, 16], [3, 16], [8, 17], [20, 17], [24, 15], [26, 15]],
  },
  {
    name: '2 · The Vault',
    subtitle: 'Three guards behind the vault doors. The moths are worth the risk.',
    map: [
      '################################',
      '#P......C....d.....C........L..#',
      '#.......C....d.....C...........#',
      '#..B....d....####.....C........#',
      '#..B....d....#..#.....C....L...#',
      '#.......d....#..#..............#',
      '#..C....d....####..B..B........#',
      '#..........d.........C.........#',
      '#..L.....C...######....d.......#',
      '#...........#......#....C......#',
      '#..B.......#......#....d.......#',
      '#..B...C...######....C.........#',
      '#..........#......#.....L......#',
      '#..C.......#......#....C.......#',
      '#......B...######.....d...E....#',
      '#..L...B.........C....d........#',
      '#......B....d......C...........#',
      '#..C........d......C.....L.....#',
      '#....C.....d...................#',
      '################################',
    ],
    guards: [
      { waypoints: [[6, 3], [24, 3], [24, 6], [6, 6]], pause: 0.8 },
      { waypoints: [[10, 10], [10, 16], [26, 16], [26, 10]], pause: 0.7 },
      { waypoints: [[28, 8], [28, 13], [20, 13], [20, 8]], pause: 1.0 },
    ],
    route: [[1, 1], [1, 7], [3, 8], [1, 11], [1, 15], [3, 15], [8, 17], [20, 17], [27, 17], [26, 14]],
  },
  {
    name: '3 · Rooftop Lamplight',
    subtitle: 'Four guards under the lamps. The last door, then dawn.',
    map: [
      '################################',
      '#P.....d......C.......d....L...#',
      '#......d......C.......d........#',
      '#..B...d....C....d......C......#',
      '#..B...d....C....d......C..L...#',
      '#......d..........d............#',
      '#..C...d...####...d...B..B.....#',
      '#.......d..#..#...d............#',
      '#..L...d...#..#...d....C.......#',
      '#.......d..####...d............#',
      '#..B...d......C...d....C.......#',
      '#..B...d......C...d....C..L....#',
      '#......d....C.....d............#',
      '#..C...d....C.....d....####....#',
      '#......d....C.....d....#..#..E.#',
      '#..L...d....C.....d....####....#',
      '#......d..........d....C.......#',
      '#..C...d....C.....d.......L....#',
      '#....C..d.....C....d...........#',
      '################################',
    ],
    guards: [
      { waypoints: [[5, 2], [24, 2], [24, 5], [5, 5]], pause: 0.8 },
      { waypoints: [[28, 6], [28, 10], [20, 10], [20, 6]], pause: 0.7 },
      { waypoints: [[6, 12], [6, 17], [14, 17], [14, 12]], pause: 0.9 },
      { waypoints: [[22, 13], [22, 17], [27, 17], [27, 12]], pause: 0.7 },
    ],
    route: [[1, 1], [1, 7], [3, 8], [1, 11], [1, 15], [3, 15], [8, 17], [20, 17], [27, 17], [29, 14]],
  },
];

// A tile is solid when it stops bodies and sight: walls and crates.
export function isSolidTile(ch) {
  return ch === '#' || ch === 'C';
}

export function isDarkTile(ch) {
  return ch === 'd';
}

export function isBushTile(ch) {
  return ch === 'B';
}

// Parse one level definition into the grid the world steps on, with the
// markers (P, L, E) lifted out into positions. The grid keeps '.' where a
// marker stood, so the floor under a moth or a door is ordinary floor.
export function parseLevel(def) {
  const grid = [];
  let playerStart = { x: TILE * 1.5, y: TILE * 1.5 };
  let exit = { x: TILE * 29.5, y: TILE * 14.5 };
  const loot = [];
  for (let row = 0; row < ROWS; row += 1) {
    const line = def.map[row];
    const gridRow = [];
    for (let col = 0; col < COLS; col += 1) {
      const ch = line[col];
      const cx = (col + 0.5) * TILE;
      const cy = (row + 0.5) * TILE;
      if (ch === 'P') {
        playerStart = { x: cx, y: cy };
        gridRow.push('.');
      } else if (ch === 'L') {
        loot.push({ x: cx, y: cy, taken: false });
        gridRow.push('.');
      } else if (ch === 'E') {
        exit = { x: cx, y: cy };
        gridRow.push('.');
      } else {
        gridRow.push(ch);
      }
    }
    grid.push(gridRow);
  }
  return { grid, playerStart, exit, loot };
}

// The tile character at a pixel position, '#' outside the map.
export function tileAtPixel(grid, x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return grid[row][col];
}

export function tileAt(grid, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return grid[row][col];
}

// Walkable for bodies: inside the map and not a solid tile.
export function walkableAt(grid, col, row) {
  return tileAt(grid, col, row) !== '#' && tileAt(grid, col, row) !== 'C';
}

export function tileCenter(col, row) {
  return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
}
