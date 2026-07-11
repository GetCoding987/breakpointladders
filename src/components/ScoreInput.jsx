import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isValidSetScore, getSetWinner, validateMatch } from '@/utils/tennisScore';
import { getDisplayName } from '@/utils/userHelpers';

/**
 * Shared score input for 8-game pro set format.
 *
 * @param {Array} players - [player1, player2] objects with id, first_name, last_name, full_name
 * @param {Array<{p1:string,p2:string}>} sets - current sets state (single set)
 * @param {string|null} retiredBy - player id who retired, or null
 * @param {function} onSetsChange - called with new sets array
 * @param {function} onRetiredByChange - called with new retiredBy value
 * @param {function} onValidationChange - called with { valid, error, winnerId, score }
 */
export default function ScoreInput({ players, sets, retiredBy, onSetsChange, onRetiredByChange, onValidationChange }) {
  const [p1, p2] = players;
  const p1Name = getDisplayName(p1)?.split(' ')[0] || 'P1';
  const p2Name = getDisplayName(p2)?.split(' ')[0] || 'P2';

  const s = sets[0] || { p1: '', p2: '' };
  const isCompleted = s.p1 !== '' && s.p2 !== '';
  const isValid = isCompleted ? isValidSetScore(s.p1, s.p2) : true;
  const winnerIdx = isCompleted ? getSetWinner(s.p1, s.p2) : -1;

  // Notify parent of validation result whenever inputs change
  useEffect(() => {
    const result = validateMatch(sets, retiredBy, p1?.id, p2?.id);
    onValidationChange?.(result);
  }, [sets, retiredBy, p1?.id, p2?.id, onValidationChange]);

  const updateSet = (index, field, value) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    onSetsChange(newSets);
  };

  return (
    <div className="space-y-4">
      {/* Pro Set Score */}
      <div>
        <label className="text-sm font-medium mb-3 block">Score (8-Game Pro Set)</label>
        <div className="space-y-2.5">
          {/* Column headers */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold w-10 text-muted-foreground"></span>
            <span className="text-xs font-semibold w-16 text-center text-muted-foreground">{p1Name}</span>
            <span className="w-2"></span>
            <span className="text-xs font-semibold w-16 text-center text-muted-foreground">{p2Name}</span>
            <span className="text-xs text-muted-foreground ml-2">Winner</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold w-10 text-muted-foreground">Set 1*</span>
            <Input
              type="number" min="0" max="9" className={`w-16 text-center ${!isValid ? 'border-red-400' : ''}`}
              placeholder="0" value={s.p1} disabled={!!retiredBy}
              onChange={e => updateSet(0, 'p1', e.target.value)}
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number" min="0" max="9" className={`w-16 text-center ${!isValid ? 'border-red-400' : ''}`}
              placeholder="0" value={s.p2} disabled={!!retiredBy}
              onChange={e => updateSet(0, 'p2', e.target.value)}
            />
            {isCompleted && (
              <span className={`text-xs font-semibold ml-2 ${isValid ? 'text-green-600' : 'text-red-500'}`}>
                {isValid ? (winnerIdx === 0 ? p1Name : p2Name) : 'Invalid'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Retirement */}
      <div className="border-t border-border pt-3">
        {!retiredBy ? (
          <div>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => onRetiredByChange(p1?.id)}
              className="text-red-600 border-red-200 hover:bg-red-50 mr-2"
            >
              {p1Name} Retired
            </Button>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => onRetiredByChange(p2?.id)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {p2Name} Retired
            </Button>
            <p className="text-xs text-muted-foreground mt-1.5">
              If a player couldn't finish the match, mark them as retired. The other player wins automatically.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">
                {retiredBy === p1?.id ? p1Name : p2Name} retired — {retiredBy === p1?.id ? p2Name : p1Name} wins
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onRetiredByChange(null)}>
              Undo
            </Button>
          </div>
        )}
      </div>

      {/* Validation error */}
      {retiredBy && !isCompleted && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Enter the set score before marking retirement.
        </div>
      )}
    </div>
  );
}