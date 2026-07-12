import { supabase } from '@/lib/supabaseClient';

export async function updateRankingsForMatch(match, ladderId) {
  const { data: allMems } = await supabase.from('ladder_memberships').select('*').match({ ladder_id: ladderId });
  const challengerMem = (allMems || []).find(m => m.user_id === match.player1_id);
  const opponentMem = (allMems || []).find(m => m.user_id === match.player2_id);

  if (match.winner_id === match.player1_id && challengerMem && opponentMem) {
    const challengerOldRank = challengerMem.rank;
    const opponentOldRank = opponentMem.rank;

    // Only reshuffle if challenger was ranked below opponent (higher number = lower position)
    if (challengerOldRank > opponentOldRank) {
      // Challenger takes opponent's rank; everyone between shifts down by 1 to fill the gap
      const updates = [];
      for (const mem of allMems) {
        if (mem.user_id === challengerMem.user_id) {
          updates.push({ id: mem.id, rank: opponentOldRank, wins: (challengerMem.wins || 0) + 1 });
        } else if (mem.user_id === opponentMem.user_id) {
          updates.push({ id: mem.id, rank: opponentOldRank + 1, losses: (opponentMem.losses || 0) + 1 });
        } else if (mem.rank >= opponentOldRank && mem.rank < challengerOldRank) {
          updates.push({ id: mem.id, rank: mem.rank + 1 });
        }
      }
      await supabase.rpc('update_ladder_ranks', { p_ladder_id: ladderId, updates });
    } else {
      // Challenger already above opponent — no rank change, just W/L
      await supabase.rpc('update_ladder_ranks', {
        p_ladder_id: ladderId,
        updates: [
          { id: challengerMem.id, wins: (challengerMem.wins || 0) + 1 },
          { id: opponentMem.id, losses: (opponentMem.losses || 0) + 1 },
        ],
      });
    }
  } else if (match.winner_id === match.player2_id && opponentMem && challengerMem) {
    await supabase.rpc('update_ladder_ranks', {
      p_ladder_id: ladderId,
      updates: [
        { id: challengerMem.id, losses: (challengerMem.losses || 0) + 1 },
        { id: opponentMem.id, wins: (opponentMem.wins || 0) + 1 },
      ],
    });
  }
}
