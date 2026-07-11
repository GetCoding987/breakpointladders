import { base44 } from '@/api/base44Client';

export async function updateRankingsForMatch(match, ladderId) {
  const allMems = await base44.entities.LadderMembership.filter({ ladder_id: ladderId });
  const challengerMem = allMems.find(m => m.user_id === match.player1_id);
  const opponentMem = allMems.find(m => m.user_id === match.player2_id);

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
      await base44.entities.LadderMembership.bulkUpdate(updates);
    } else {
      // Challenger already above opponent — no rank change, just W/L
      await base44.entities.LadderMembership.update(challengerMem.id, {
        wins: (challengerMem.wins || 0) + 1,
      });
      await base44.entities.LadderMembership.update(opponentMem.id, {
        losses: (opponentMem.losses || 0) + 1,
      });
    }
  } else if (match.winner_id === match.player2_id && opponentMem && challengerMem) {
    await base44.entities.LadderMembership.update(challengerMem.id, {
      losses: (challengerMem.losses || 0) + 1,
    });
    await base44.entities.LadderMembership.update(opponentMem.id, {
      wins: (opponentMem.wins || 0) + 1,
    });
  }
}