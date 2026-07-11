import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PlayerAvatar from '@/components/PlayerAvatar';
import ScoreInput from '@/components/ScoreInput';
import { getDisplayName } from '@/utils/userHelpers';

export default function ProposeScoreDialog({ open, onOpenChange, players, onSubmit, currentScore }) {
  const [sets, setSets] = useState([
    { p1: '', p2: '' }
  ]);
  const [retiredBy, setRetiredBy] = useState(null);
  const [validation, setValidation] = useState({ valid: false, error: null, winnerId: null, score: '' });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSets([{ p1: '', p2: '' }]);
      setRetiredBy(null);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!validation.valid || !validation.winnerId) return;
    onSubmit({ winner_id: validation.winnerId, score: validation.score });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Propose Corrected Score</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">Current submitted score: <strong>{currentScore}</strong></p>

          {/* Players */}
          <div className="flex items-center justify-center gap-6 py-2">
            {players.map((p, i) => (
              <div key={p?.id || i} className="flex flex-col items-center">
                <PlayerAvatar user={p} size="md" />
                <p className="text-sm font-semibold mt-2">{getDisplayName(p)}</p>
                <p className="text-xs text-muted-foreground">{i === 0 ? 'Player 1' : 'Player 2'}</p>
              </div>
            ))}
          </div>

          <ScoreInput
            players={players}
            sets={sets}
            retiredBy={retiredBy}
            onSetsChange={setSets}
            onRetiredByChange={setRetiredBy}
            onValidationChange={setValidation}
          />

          {validation.valid && validation.winnerId && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs">✓</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-green-700">
                  Winner: {getDisplayName(players.find(p => p?.id === validation.winnerId))}
                </p>
                <p className="text-xs text-green-600">Score: {validation.score}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!validation.valid}
              className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]"
            >
              Propose Score
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}