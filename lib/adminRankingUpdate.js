// Service-role counterpart to src/utils/matchRanking.js's updateRankingsForMatch.
// That version calls the update_ladder_ranks RPC, which requires auth.uid() to
// be a member of the ladder (or admin) — both null under a service-role/cron
// call with no user JWT. This mirrors the same rank-shift algorithm but writes
// directly via supabaseAdmin (bypasses RLS), same pattern as lib/ladderPlacement.js.
export async function updateRankingsForForfeit(supabaseAdmin, { ladderId, winnerId, loserId, extraLoserFields = {} }) {
	const { data: allMems } = await supabaseAdmin.from('ladder_memberships').select('*').match({ ladder_id: ladderId });
	const winnerMem = (allMems || []).find(m => m.user_id === winnerId);
	const loserMem = (allMems || []).find(m => m.user_id === loserId);
	if (!winnerMem || !loserMem) return;

	const winnerOldRank = winnerMem.rank;
	const loserOldRank = loserMem.rank;

	if (winnerOldRank > loserOldRank) {
		// Winner was ranked below the loser — winner takes the loser's rank,
		// everyone between shifts down by 1 to fill the gap.
		await Promise.all((allMems || []).map(mem => {
			if (mem.user_id === winnerMem.user_id) {
				return supabaseAdmin.from('ladder_memberships').update({ rank: loserOldRank, wins: (winnerMem.wins || 0) + 1 }).eq('id', mem.id);
			}
			if (mem.user_id === loserMem.user_id) {
				return supabaseAdmin.from('ladder_memberships').update({ rank: loserOldRank + 1, losses: (loserMem.losses || 0) + 1, ...extraLoserFields }).eq('id', mem.id);
			}
			if (mem.rank >= loserOldRank && mem.rank < winnerOldRank) {
				return supabaseAdmin.from('ladder_memberships').update({ rank: mem.rank + 1 }).eq('id', mem.id);
			}
			return null;
		}).filter(Boolean));
	} else {
		// Winner already above the loser — no rank change, just W/L.
		await Promise.all([
			supabaseAdmin.from('ladder_memberships').update({ wins: (winnerMem.wins || 0) + 1 }).eq('id', winnerMem.id),
			supabaseAdmin.from('ladder_memberships').update({ losses: (loserMem.losses || 0) + 1, ...extraLoserFields }).eq('id', loserMem.id),
		]);
	}
}
