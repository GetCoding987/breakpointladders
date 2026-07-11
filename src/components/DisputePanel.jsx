import { AlertCircle, CheckCircle, Shield, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDisplayName } from '@/utils/userHelpers';

export default function DisputePanel({ match, currentUser, allUsers, onProposeScore, onAcceptScore, onNotifyAdmin, notifyingAdmin }) {
  if (!match) return null;

  const submittedWinner = allUsers[match.winner_id];
  const proposedByMe = match.proposed_by_id === currentUser.id;
  const hasProposal = !!match.proposed_score;
  const canAccept = hasProposal && !proposedByMe;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
      <div className="flex items-start gap-3 mb-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm text-amber-900">Score Disputed</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Submitted score: <strong>{match.score}</strong> &middot; Winner: <strong>{getDisplayName(submittedWinner)}</strong>
          </p>
          {hasProposal && (
            <p className="text-xs text-amber-700 mt-1">
              {proposedByMe ? 'You proposed' : `${getDisplayName(allUsers[match.proposed_by_id])} proposed`} corrected score:{' '}
              <strong>{match.proposed_score}</strong> &middot; Winner: <strong>{getDisplayName(allUsers[match.proposed_winner_id])}</strong>
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {!proposedByMe && (
          <Button
            size="sm"
            variant="outline"
            onClick={onProposeScore}
            className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <Edit3 className="w-3 h-3 mr-1" /> Propose Corrected Score
          </Button>
        )}
        {canAccept && (
          <Button
            size="sm"
            onClick={onAcceptScore}
            className="h-8 text-xs bg-green-600 hover:bg-green-700 gap-1"
          >
            <CheckCircle className="w-3 h-3" /> Accept Proposed Score
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onNotifyAdmin}
          disabled={notifyingAdmin}
          className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
        >
          <Shield className="w-3 h-3 mr-1" /> {notifyingAdmin ? 'Notifying...' : 'Notify Admin'}
        </Button>
      </div>
    </div>
  );
}