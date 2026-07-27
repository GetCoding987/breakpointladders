import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, getCurrentUser, callApi } from '@/lib/supabaseClient';
import { Clock, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PlayerAvatar from '@/components/PlayerAvatar';
import { getDisplayName } from '@/utils/userHelpers';
import { formatEasternDateFull } from '@/utils/easternTime';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-slate-100 text-slate-600',
  expired: 'bg-slate-100 text-slate-500',
};

export default function ChallengesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [loading, setLoading] = useState(true);

  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const u = await getCurrentUser();
    setUser(u);

    const { data: memberships } = await supabase.from('ladder_memberships').select('*').match({ user_id: u.id });
    if (!memberships || memberships.length === 0) {
      setLoading(false);
      return;
    }
    const mem = memberships[0];
    setMembership(mem);

    const { data: allChallenges } = await supabase.from('challenges').select('*').match({ ladder_id: mem.ladder_id });
    const mine = (allChallenges || []).filter((c) => c.challenger_id === u.id || c.opponent_id === u.id);
    setChallenges(mine.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));

    const { data: allMems } = await supabase.from('ladder_memberships').select('*').match({ ladder_id: mem.ladder_id });
    const map = {};
    (allMems || []).forEach((m) => {
      map[m.user_id] = { id: m.user_id, full_name: m.display_name, avatar_url: m.avatar_url, location: m.location };
    });
    map[u.id] = u;
    setAllUsers(map);

    setLoading(false);
  };

  const acceptChallenge = async (challenge) => {
    await supabase.from('challenges').update({ status: 'accepted', accepted_date: new Date().toISOString() }).eq('id', challenge.id);
    if (membership) {
      await supabase.from('ladder_memberships').update({ no_response_streak: 0 }).eq('id', membership.id);
    }
    try {
      await callApi('/api/notify', {
        user_id: challenge.challenger_id,
        type: 'challenge_accepted',
        title: 'Challenge Accepted!',
        body: `${getDisplayName(allUsers[challenge.opponent_id])} has accepted your challenge.`,
      });
    } catch (err) {
      console.warn('Failed to send notification:', err?.message);
    }
    load();
  };

  const cancelChallenge = async (challenge) => {
    if (!window.confirm('Cancel this challenge? The opponent will be notified.')) return;
    await supabase.from('challenges').update({ status: 'cancelled' }).eq('id', challenge.id);
    try {
      await callApi('/api/notify', {
        user_id: challenge.opponent_id,
        type: 'challenge_declined',
        title: 'Challenge Cancelled',
        body: `${getDisplayName(user)} has cancelled their challenge.`,
      });
    } catch (err) {
      console.warn('Failed to send notification:', err?.message);
    }
    load();
  };

  const openDecline = (challenge) => {
    setDeclineTarget(challenge);
    setDeclineReason('');
  };

  const confirmDecline = async () => {
    if (!declineReason.trim()) return;
    setDeclining(true);
    const challengerId = declineTarget.challenger_id;

    const prevDeclines = challenges.filter((c) =>
      c.challenger_id === challengerId &&
      c.opponent_id === user.id &&
      c.status === 'declined'
    ).length;

    const isForfeited = prevDeclines >= 2;
    const newStatus = isForfeited ? 'completed' : 'declined';

    await supabase.from('challenges').update({
      status: newStatus,
      message: (declineTarget.message ? declineTarget.message + '\n\nDecline reason: ' : 'Decline reason: ') + declineReason.trim(),
    }).eq('id', declineTarget.id);

    if (membership) {
      await supabase.from('ladder_memberships').update({ no_response_streak: 0 }).eq('id', membership.id);
    }

    try {
      await callApi('/api/notify', {
        user_id: challengerId,
        type: 'challenge_declined',
        title: isForfeited ? 'Challenge Forfeited' : 'Challenge Declined',
        body: isForfeited
          ? `${getDisplayName(allUsers[declineTarget.opponent_id])} has declined your challenge 3 times. This counts as a forfeit.`
          : `${getDisplayName(allUsers[declineTarget.opponent_id])} declined your challenge. Reason: ${declineReason.trim()}`,
      });
    } catch (err) {
      console.warn('Failed to send notification:', err?.message);
    }

    setDeclineTarget(null);
    setDeclineReason('');
    setDeclining(false);
    load();
  };

  const messageOpponent = (challenge) => {
    const otherId = challenge.challenger_id === user?.id ? challenge.opponent_id : challenge.challenger_id;
    navigate(`/messages?new=${otherId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-6xl mb-4">🎾</div>
        <h2 className="text-2xl font-bold mb-2">Join a Ladder</h2>
        <p className="text-muted-foreground mb-6 max-w-md">You haven't joined any ladder yet. Join one to start competing!</p>
        <Button asChild className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]">
          <Link to="/ladder">Browse Ladders</Link>
        </Button>
      </div>
    );
  }

  const receivedPending = challenges.filter((c) => c.status === 'pending' && c.opponent_id === user?.id);
  const madePending = challenges.filter((c) => c.status === 'pending' && c.challenger_id === user?.id);
  const acceptedChallenges = challenges.filter((c) => c.status === 'accepted');
  const history = challenges.filter((c) => ['declined', 'completed', 'cancelled', 'expired'].includes(c.status));

  const renderRow = (c, { children } = {}) => {
    const isChallenger = c.challenger_id === user?.id;
    const otherUser = allUsers[isChallenger ? c.opponent_id : c.challenger_id];
    return (
      <div key={c.id} className="flex items-center gap-3 px-4 py-3">
        <PlayerAvatar user={otherUser} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {isChallenger ? 'You challenged' : 'Challenged by'} {getDisplayName(otherUser)}
          </p>
          <p className="text-xs text-muted-foreground">
            #{c.challenger_rank_at_time} vs #{c.opponent_rank_at_time} · {c.created_date ? formatEasternDateFull(c.created_date) : '—'}
          </p>
        </div>
        {children}
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusColors[c.status] || 'bg-slate-100 text-slate-600'}`}>
          {c.status}
        </span>
      </div>
    );
  };

  return (
    <div className="p-3 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Challenges</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Full history of challenges made, received, and accepted</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Received */}
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">Challenges Received</h2>
          </div>
          <div className="divide-y divide-border">
            {receivedPending.map((c) => {
              const otherUser = allUsers[c.challenger_id];
              const hoursLeft = c.created_date ? Math.max(0, 48 - Math.floor((Date.now() - new Date(c.created_date)) / 3600000)) : 48;
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <PlayerAvatar user={otherUser} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">Challenged by {getDisplayName(otherUser)}</p>
                    <div className={`text-xs font-bold flex items-center gap-1 ${hoursLeft < 24 ? 'text-red-500' : 'text-amber-500'}`}>
                      <Clock className="w-3 h-3" />
                      {hoursLeft}h left to respond
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button size="sm" onClick={() => acceptChallenge(c)} className="bg-green-600 hover:bg-green-700 h-8 text-xs px-2 gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openDecline(c)} className="h-8 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50 gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Decline
                    </Button>
                  </div>
                </div>
              );
            })}
            {receivedPending.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">None</div>
            )}
          </div>
        </div>

        {/* Made */}
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">Challenges Made</h2>
          </div>
          <div className="divide-y divide-border">
            {madePending.map((c) => {
              const otherUser = allUsers[c.opponent_id];
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <PlayerAvatar user={otherUser} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">You challenged {getDisplayName(otherUser)}</p>
                    <p className="text-xs text-muted-foreground">Awaiting response</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => cancelChallenge(c)} className="h-8 text-xs px-2 flex-shrink-0">
                    Cancel
                  </Button>
                </div>
              );
            })}
            {madePending.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">None</div>
            )}
          </div>
        </div>

        {/* Accepted */}
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">Accepted Challenges</h2>
          </div>
          <div className="divide-y divide-border">
            {acceptedChallenges.map((c) => {
              const isChallenger = c.challenger_id === user?.id;
              const otherUser = allUsers[isChallenger ? c.opponent_id : c.challenger_id];
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <PlayerAvatar user={otherUser} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">vs {getDisplayName(otherUser)}</p>
                    <p className="text-xs text-muted-foreground">Scheduled — awaiting match</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button size="sm" asChild className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] h-8 text-xs px-2">
                      <Link to={`/matches?challenge=${c.id}`}>Submit Score</Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => messageOpponent(c)} className="h-8 text-xs px-2 gap-1">
                      <MessageSquare className="w-3.5 h-3.5" /> Message
                    </Button>
                  </div>
                </div>
              );
            })}
            {acceptedChallenges.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">None</div>
            )}
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">History</h2>
          </div>
          <div className="divide-y divide-border">
            {history.map((c) => renderRow(c))}
            {history.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No past challenges yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Decline Dialog */}
      <Dialog open={!!declineTarget} onOpenChange={() => setDeclineTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Decline Challenge</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              You must provide a reason for declining. Note: declining the same challenger 3 times in a row results in an automatic forfeit.
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Reason for declining <span className="text-red-500">*</span></label>
              <Textarea
                placeholder="e.g. I'm unavailable during that time..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeclineTarget(null)}>Cancel</Button>
              <Button
                onClick={confirmDecline}
                disabled={!declineReason.trim() || declining}
                className="bg-red-600 hover:bg-red-700 gap-2"
              >
                <XCircle className="w-4 h-4" />
                {declining ? 'Declining...' : 'Confirm Decline'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
