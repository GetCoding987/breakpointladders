/**
 * Validates an 8-game pro set score.
 * Valid scores: 8-0 to 8-6, 9-7, 9-8 (tiebreak at 8-8).
 */
export function isValidSetScore(p1, p2) {
  const a = parseInt(p1);
  const b = parseInt(p2);
  if (isNaN(a) || isNaN(b)) return false;
  if (a === b) return false;
  if (a < 0 || b < 0) return false;

  const winner = Math.max(a, b);
  const loser = Math.min(a, b);

  // Win 8 games by 2+, opponent has 6 or fewer
  if (winner === 8 && loser <= 6) return true;
  // Win 9-7 (win by 2 after 7-7)
  if (winner === 9 && loser === 7) return true;
  // Tiebreak 9-8 (at 8-8)
  if (winner === 9 && loser === 8) return true;

  return false;
}

/**
 * Returns the set winner's index (0 for p1, 1 for p2) or -1 if tied/invalid.
 */
export function getSetWinner(p1, p2) {
  const a = parseInt(p1);
  const b = parseInt(p2);
  if (isNaN(a) || isNaN(b) || a === b) return -1;
  return a > b ? 0 : 1;
}

/**
 * Validates a full match score (8-game pro set format — single set).
 * @param {Array<{p1: string, p2: string}>} sets - single pro set
 * @param {string|null} retiredBy - player id who retired, or null
 * @param {string} player1Id
 * @param {string} player2Id
 * @returns {{ valid: boolean, error: string|null, winnerId: string|null, score: string }}
 */
export function validateMatch(sets, retiredBy, player1Id, player2Id) {
  const completedSets = sets.filter(s => s.p1 !== '' && s.p2 !== '');

  // Build score string from completed sets
  const score = completedSets.map(s => `${s.p1}-${s.p2}`).join(', ');

  // Retirement: the non-retiring player wins
  if (retiredBy) {
    if (completedSets.length === 0) {
      return { valid: false, error: 'Enter the set score before retirement.', winnerId: null, score };
    }
    const winnerId = retiredBy === player1Id ? player2Id : player1Id;
    return { valid: true, error: null, winnerId, score: score + ' (retired)' };
  }

  // No retirement: need at least 1 set
  if (completedSets.length < 1) {
    return { valid: false, error: 'Enter the set score.', winnerId: null, score };
  }

  // Validate the set score
  const s = completedSets[0];
  if (!isValidSetScore(s.p1, s.p2)) {
    return { valid: false, error: `Invalid score: ${s.p1}-${s.p2}. Valid scores: 8-0 to 8-6, 9-7, 9-8.`, winnerId: null, score };
  }

  // Determine match winner (whoever wins the pro set)
  const winnerIdx = getSetWinner(s.p1, s.p2);
  if (winnerIdx === 0) {
    return { valid: true, error: null, winnerId: player1Id, score };
  }
  if (winnerIdx === 1) {
    return { valid: true, error: null, winnerId: player2Id, score };
  }

  return { valid: false, error: 'Match must have a clear winner.', winnerId: null, score };
}