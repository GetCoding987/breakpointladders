import { Calendar, Check, X, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDisplayName } from '@/utils/userHelpers';

export default function MatchSchedulePanel({ challenge, currentUser, allUsers, onPropose, onAccept, onCounter }) {
  if (!challenge) return null;

  const isProposer = challenge.proposed_by_id === currentUser.id;
  const proposer = allUsers[challenge.proposed_by_id];
  const otherId = challenge.challenger_id === currentUser.id ? challenge.opponent_id : challenge.challenger_id;
  const otherUser = allUsers[otherId];
  const hasProposal = challenge.proposal_status === 'proposed' && challenge.proposed_date;
  const isAccepted = challenge.proposal_status === 'accepted';

  return (
    <div className="px-6 py-3 border-b border-border bg-blue-50/50">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-4 h-4 text-[hsl(217,72%,40%)]" />
        <p className="text-sm font-semibold">Match Scheduling</p>
      </div>

      {isAccepted ? (
        <div className="text-sm">
          <p className="text-green-700 font-medium mb-1 flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Match Scheduled
          </p>
          <div className="flex flex-col gap-1 pl-2 border-l-2 border-green-300">
            <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {challenge.proposed_date} at {challenge.proposed_time}</p>
            {challenge.proposed_location && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {challenge.proposed_location}</p>}
          </div>
        </div>
      ) : hasProposal ? (
        <div className="text-sm">
          <p className="mb-1.5">
            <span className="font-medium">{getDisplayName(proposer)}</span> proposed:
          </p>
          <div className="flex flex-col gap-1 mb-3 pl-2 border-l-2 border-blue-200">
            <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {challenge.proposed_date} at {challenge.proposed_time}</p>
            {challenge.proposed_location && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {challenge.proposed_location}</p>}
          </div>
          {isProposer ? (
            <p className="text-xs text-muted-foreground">Waiting for {getDisplayName(otherUser)} to respond...</p>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={onAccept} className="bg-green-600 hover:bg-green-700 h-8 text-xs gap-1">
                <Check className="w-3.5 h-3.5" /> Accept Time
              </Button>
              <Button size="sm" variant="outline" onClick={onCounter} className="h-8 text-xs gap-1">
                <Calendar className="w-3.5 h-3.5" /> Propose New Time
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button size="sm" onClick={onPropose} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] h-8 text-xs gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Propose Match Time
        </Button>
      )}
    </div>
  );
}