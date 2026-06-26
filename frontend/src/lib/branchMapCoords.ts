import type { Branch } from '../types';

/** Showroom coordinates when DB values are missing. */
const BRANCH_COORDINATE_FALLBACKS: { match: RegExp; coords: [number, number] }[] = [
  {
    match: /hadi ev/i,
    coords: [29.806322679116477, 72.86908609999999],
  },
  {
    match: /crown ev center|bahawalnagar|crown eve bahawalnagar/i,
    coords: [29.995425472044637, 73.2428932264022],
  },
];

export function resolveBranchCoords(branch: Branch): [number, number] | null {
  if (branch.latitude != null && branch.longitude != null) {
    const lat = Number(branch.latitude);
    const lng = Number(branch.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }

  const haystack = `${branch.name} ${branch.location}`;
  for (const { match, coords } of BRANCH_COORDINATE_FALLBACKS) {
    if (match.test(haystack)) return coords;
  }

  return null;
}

export type BranchMapPoint = {
  branch: Branch;
  coords: [number, number];
  /** Marker position — may be offset when branches share identical coordinates. */
  markerCoords: [number, number];
};

const COORD_KEY_PRECISION = 5;
const OVERLAP_OFFSET = 0.012;

/** Spread markers that share the same lat/lng so each branch pin stays visible. */
export function buildBranchMapPoints(branches: Branch[]): BranchMapPoint[] {
  const resolved = branches
    .map((branch) => {
      const coords = resolveBranchCoords(branch);
      return coords ? { branch, coords } : null;
    })
    .filter((entry): entry is { branch: Branch; coords: [number, number] } => entry !== null);

  const groups = new Map<string, { branch: Branch; coords: [number, number] }[]>();
  for (const entry of resolved) {
    const key = `${entry.coords[0].toFixed(COORD_KEY_PRECISION)},${entry.coords[1].toFixed(COORD_KEY_PRECISION)}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const points: BranchMapPoint[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      points.push({ ...group[0], markerCoords: group[0].coords });
      continue;
    }

    group.forEach((entry, index) => {
      const angle = (2 * Math.PI * index) / group.length;
      points.push({
        ...entry,
        markerCoords: [
          entry.coords[0] + OVERLAP_OFFSET * Math.cos(angle),
          entry.coords[1] + OVERLAP_OFFSET * Math.sin(angle),
        ],
      });
    });
  }

  return points;
}
