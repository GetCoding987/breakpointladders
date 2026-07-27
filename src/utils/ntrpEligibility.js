/**
 * Whether a player's NTRP rating falls within a ladder's configured range.
 * Either bound being null/undefined means that side is unrestricted, so a
 * ladder with no range configured at all is open to every rating.
 */
export function isNtrpEligible(rating, ntrpMin, ntrpMax) {
	if (rating == null) return true;
	if (ntrpMin != null && rating < ntrpMin) return false;
	if (ntrpMax != null && rating > ntrpMax) return false;
	return true;
}
