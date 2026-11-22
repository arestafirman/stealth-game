// Breadth-first pathfinding on the tile grid. Guards and the screenshot
// autopilot both walk tile to tile, so both ask this one function for a route
// and then follow its cell centres. Returns a list of [col, row] steps from
// the tile after `from` up to and including `to`, or null when no route
// exists. `walkable(col, row)` is supplied by the caller.
export function findPath(walkable, cols, rows, from, to) {
  const fromKey = from[1] * cols + from[0];
  const toKey = to[1] * cols + to[0];
  if (fromKey === toKey) return [];
  if (!walkable(to[0], to[1])) return null;
  const cameFrom = new Map();
  const queue = [fromKey];
  cameFrom.set(fromKey, -1);
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const key = queue.shift();
    if (key === toKey) break;
    const col = key % cols;
    const row = Math.floor(key / cols);
    for (let i = 0; i < neighbours.length; i += 1) {
      const ncol = col + neighbours[i][0];
      const nrow = row + neighbours[i][1];
      if (ncol < 0 || ncol >= cols || nrow < 0 || nrow >= rows) continue;
      const nkey = nrow * cols + ncol;
      if (cameFrom.has(nkey)) continue;
      if (!walkable(ncol, nrow)) continue;
      cameFrom.set(nkey, key);
      queue.push(nkey);
    }
  }
  if (!cameFrom.has(toKey)) return null;
  const path = [];
  let key = toKey;
  while (key !== fromKey) {
    path.push([key % cols, Math.floor(key / cols)]);
    key = cameFrom.get(key);
  }
  path.reverse();
  return path;
}
