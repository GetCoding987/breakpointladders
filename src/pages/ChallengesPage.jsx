import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, getCurrentUser, callApi } from '@/lib/supabaseClient';
import { Swords, Clock, CheckCircle, XCircle, Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import PlayerAvatar from '@/components/PlayerAvatar';
import { formatEasternDateFull } from '@/utils/easternTime';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getDisplayName } from '@/utils/userHelpers';
import { withRetry } from '@/utils/apiRetry';

export default function ChallengesPage() {
  const [user, setUser] = useState(null);
  const [myMembership, setMyMembership] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [eligiblePlayers, setEligiblePlayers] = useState([]);
  const [challengeMsg, setChallengeMsg] = useState('');
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Decline dialog state
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const opponentId = searchParams.get('opponent');
    if (opponentId && eligiblePlayers.length > 0) {
      const op = eligiblePlayers.find(p => p.user_id === opponentId);
      if (op) { setSelectedOpponent(op); setShowNewChallenge(true); }
    }
  }, [searchParams, eligiblePlayers]);

  const load = async () => {
    setLoading(true);
    const u = await withRetry(() => getCurrentUser());
    setUser(u);

    const { data: mems } = await withRetry(() => supabase.from('ladder_memberships').select('*').match({ user_id: u.id }));
    if (!mems || mems.length === 0) { setLoading(false); return; }
    const mem = mems[0];
    setMyMembership(mem);

    const { data: allChallenges } = await withRetry(() => supabase.from('challenges').select('*').match({ ladder_id: mem.ladder_id }));
    const mine = (allChallenges || []).filter(c => c.challenger_id === u.id || c.opponent_id === u.id);
    setChallenges(mine.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));

    const { data: allMems } = await withRetry(() => supabase.from('ladder_memberships').select('*').match({ ladder_id: mem.ladder_id }));
    const window = 10;
    const myRank = mem.rank || 999;
    const isTop5 = myRank <= 5;
    const eligible = (allMems || []).filter(m => {
      if (m.user_id === u.id || m.status !== 'active') return false;
      const targetRank = m.rank || 999;
      if (targetRank < myRank) return (myRank - targetRank) <= window;
      // Top 5 players can also challenge up to 10 spots below them
      if (isTop5 && targetRank > myRank) return (targetRank - myRank) <= 10;
      return false;
    });
    setEligiblePlayers(eligible.sort((a, b) => (a.rank || 999) - (b.rank || 999)));

    const map = {};
    (allMems || []).forEach(m => { map[m.user_id] = { id: m.user_id, full_name: m.display_name, avatar_url: m.avatar_url, location: m.location, city: m.city, state: m.state }; });
    map[u.id] = u;
    setAllUsers(map);
    setLoading(false);
  };

  const sendChallenge = async () => {
    if (!selectedOpponent) return;
    setSubmitting(true);

    // Enforce: no new challenge if already has a pending challenge awaiting response
    const alreadyPending = challenges.some(c => c.challenger_id === user.id && c.status === 'pending');
    if (alreadyPending) {
      setSubmitting(false);
      alert('You already have a pending challenge awaiting a response. You cannot send another until it is accepted or declined.');
      return;
    }

    await supabase.from('challenges').insert({
      challenger_id: user.id,
      opponent_id: selectedOpponent.user_id,
      ladder_id: myMembership.ladder_id,
      status: 'pending',
      challenger_rank_at_time: myMembership.rank,
      opponent_rank_at_time: selectedOpponent.rank,
      message: challengeMsg,
    });
    try {
      await callApi('/api/notify', {
        user_id: selectedOpponent.user_id,
        type: 'challenge_received',
        title: 'New Challenge!',
        body: `${getDisplayName(user)} has challenged you on the ladder.`,
      });
    } catch (err) {
      console.warn('Failed to send challenge notification:', err?.message);
    }
    setShowNewChallenge(false);
    setSelectedOpponent(null);
    setChallengeMsg('');
    setSubmitting(false);
    load();
  };

  const acceptChallenge = async (challenge) => {
    await supabase.from('challenges').update({ status: 'accepted' }).eq('id', challenge.id);
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

    // Count how many times this challenger has been declined in a row
    const prevDeclines = challenges.filter(c =>
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

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    completed: 'bg-slate-100 text-slate-600',
    cancelled: 'bg-slate-100 text-slate-600',
    expired: 'bg-slate-100 text-slate-500',
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Challenges</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your challenge requests</p>
        </div>
        {myMembership?.status === 'active' && (() => {
          const hasPending = challenges.some(c => c.challenger_id === user?.id && c.status === 'pending');
          return (
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={() => setShowNewChallenge(true)}
                disabled={hasPending}
                className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2 disabled:opacity-50"
              >
                <Swords className="w-4 h-4" />
                New Challenge
              </Button>
              {hasPending && <p className="text-xs text-muted-foreground">You have a pending challenge</p>}
            </div>
          );
        })()}
      </div>

      <div className="space-y-3">
        {challenges.map((c) => {
          const isChallenger = c.challenger_id === user?.id;
          const otherUserId = isChallenger ? c.opponent_id : c.challenger_id;
          const otherUser = allUsers[otherUserId];
          const isPending = c.status === 'pending' && !isChallenger;
          const isAccepted = c.status === 'accepted';

          return (
            <div key={c.id} className="bg-white rounded-2xl border border-border p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <PlayerAvatar user={otherUser} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold">
                      {isChallenger ? `You → ${getDisplayName(otherUser)}` : `${getDisplayName(otherUser)} → You`}
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[c.status]}`}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Challenger Rank #{c.challenger_rank_at_time} vs Opponent Rank #{c.opponent_rank_at_time}
                  </p>
                  {c.proposed_date && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Proposed: {c.proposed_date}
                    </p>
                  )}
                  {c.message && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{c.message}"</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Sent {c.created_date ? formatEasternDateFull(c.created_date) : '—'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 items-stretch sm:items-end">
                  {isPending && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => acceptChallenge(c)} className="bg-green-600 hover:bg-green-700 h-8 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openDecline(c)} className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50">
                        <XCircle className="w-3 h-3 mr-1" /> Decline
                      </Button>
                    </div>
                  )}
                  {c.status === 'pending' && isChallenger && (
                    <Button size="sm" variant="outline" onClick={() => cancelChallenge(c)} className="h-8 text-xs text-slate-600 border-slate-200 hover:bg-slate-50">
                      <XCircle className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                  )}
                  {isAccepted && (
                    <div className="flex gap-2">
                      <Button size="sm" asChild className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] h-8 text-xs">
                        <a href={`/matches/submit?challenge=${c.id}`}>Submit Score</a>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => messageOpponent(c)} className="h-8 text-xs gap-1">
                        <MessageSquare className="w-3 h-3" /> Message
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {challenges.length === 0 && (
          <div className="bg-white rounded-2xl border border-border p-12 text-center">
            <Swords className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">No challenges yet. Challenge a player to get started!</p>
          </div>
        )}
      </div>

      {/* New Challenge Dialog */}
      <Dialog open={showNewChallenge} onOpenChange={setShowNewChallenge}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send a Challenge</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Opponent</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {eligiblePlayers.map(ep => {
                  const epUser = allUsers[ep.user_id];
                  const isSelected = selectedOpponent?.user_id === ep.user_id;
                  return (
                    <button key={ep.user_id} onClick={() => setSelectedOpponent(ep)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected ? 'border-[hsl(217,72%,40%)] bg-blue-50' : 'border-border hover:bg-muted/30'}`}>
                      <PlayerAvatar user={epUser} size="sm" />
                      <div className="text-left">
                        <p className="text-sm font-semibold">{getDisplayName(epUser)}</p>
                        <p className="text-xs text-muted-foreground">Rank #{ep.rank}</p>
                      </div>
                    </button>
                  );
                })}
                {eligiblePlayers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No eligible players to challenge. You can only challenge players within 10 spots above you.</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Message (optional)</label>
              <Textarea placeholder="Add a friendly message..." value={challengeMsg} onChange={e => setChallengeMsg(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowNewChallenge(false)}>Cancel</Button>
              <Button onClick={sendChallenge} disabled={!selectedOpponent || submitting} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2">
                <Send className="w-4 h-4" />
                {submitting ? 'Sending...' : 'Send Challenge'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                onChange={e => setDeclineReason(e.target.value)}
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