// Computes where a new ladder member should be inserted based on NTRP rating:
// immediately below the lowest-ranked existing member rated at least as good
// as them (same rating, or nearest better rating if no exact match), shifting
// everyone below down by one rank. Falls back to the bottom of the whole
// ladder if no rated members exist at all.
export async function computeInitialRankAndShift(supabaseAdmin, ladderId, ntrpRating) {
	const { data: mems } = await supabaseAdmin
		.from('ladder_memberships')
		.select('id, rank, user_id')
		.eq('ladder_id', ladderId);
	if (!mems || mems.length === 0) return 1;

	let targetRank = null;
	if (ntrpRating != null) {
		const { data: profs } = await supabaseAdmin
			.from('profiles')
			.select('id, ntrp_rating')
			.in('id', mems.map((m) => m.user_id));
		const ratingById = Object.fromEntries((profs || []).map((p) => [p.id, p.ntrp_rating]));
		const betterOrEqual = mems.filter((m) => ratingById[m.user_id] != null && ratingById[m.user_id] >= ntrpRating);
		if (betterOrEqual.length > 0) {
			targetRank = Math.max(...betterOrEqual.map((m) => m.rank || 0)) + 1;
		}
	}
	if (targetRank == null) {
		targetRank = Math.max(...mems.map((m) => m.rank || 0)) + 1;
	}

	// Shift everyone at or below the target rank down by one. Done as direct
	// updates (not the update_ladder_ranks RPC) since that RPC authorizes
	// against auth.uid(), which is null for service-role backend calls —
	// supabaseAdmin already bypasses RLS, so direct updates are simpler and correct here.
	const toShift = mems.filter((m) => (m.rank || 0) >= targetRank);
	await Promise.all(
		toShift.map((m) => supabaseAdmin.from('ladder_memberships').update({ rank: (m.rank || 0) + 1 }).eq('id', m.id))
	);

	return targetRank;
}
