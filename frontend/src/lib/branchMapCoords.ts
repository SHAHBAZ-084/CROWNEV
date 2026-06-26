import type { Branch } from '../types';

/** User-provided showroom coordinates (fallback when DB value missing). */
const BRANCH_COORDINATE_FALLBACKS: { match: RegExp; coords: [number, number] }[] = [
  {
    match: /bahawalnagar|crown eve bahawalnagar/i,
    coords: [29.995378379735364, 73.24281476617726],
  },
  {
    match: /hadi ev/i,
    coords: [29.806459600175703, 72.86913501963214],
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
