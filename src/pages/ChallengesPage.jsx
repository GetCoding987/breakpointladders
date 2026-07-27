import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, getCurrentUser, callApi } from '@/lib/supabaseClient';
import { Clock, CheckCircle, XCircle, MessageSquare, Swords, Send } from 'lucide-react';
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
  const [eligiblePlayers, setEligiblePlayers] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [loading, setLoading] = useState(true);

  // New Challenge dialog
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [challengeMsg, setChallengeMsg] = useState('');
  const [submittingChallenge, setSubmittingChallenge] = useState(false);

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

    // Anyone already in a pending or accepted challenge (either side) can't be challenged
    const busyUserIds = new Set();
    (allChallenges || []).forEach((c) => {
      if (c.status === 'pending' || c.status === 'accepted') {
        busyUserIds.add(c.challenger_id);
        busyUserIds.add(c.opponent_id);
      }
    });
    const rankWindow = 10;
    const myRank = mem.rank || 999;
    const isTop5 = myRank <= 5;
    const eligible = (allMems || []).filter((m) => {
      if (m.user_id === u.id || m.status !== 'active' || busyUserIds.has(m.user_id)) return false;
      const targetRank = m.rank || 999;
      if (targetRank < myRank) return (myRank - targetRank) <= rankWindow;
      if (isTop5 && targetRank > myRank) return (targetRank - myRank) <= 10;
      return false;
    });
    setEligiblePlayers(eligible.sort((a, b) => (a.rank || 999) - (b.rank || 999)));

    setLoading(false);
  };

  const sendChallenge = async () => {
    if (!selectedOpponent || !membership) return;
    setSubmittingChallenge(true);

    const alreadyPending = challenges.some((c) => c.challenger_id === user.id && c.status === 'pending');
    if (alreadyPending) {
      setSubmittingChallenge(false);
      alert('You already have a pending challenge awaiting a response. You cannot send another until it is accepted or declined.');
      return;
    }

    const { data: opponentBusy } = await supabase
      .from('challenges')
      .select('id')
      .match({ ladder_id: membership.ladder_id })
      .in('status', ['pending', 'accepted'])
      .or(`challenger_id.eq.${selectedOpponent.user_id},opponent_id.eq.${selectedOpponent.user_id}`);
    if (opponentBusy?.length > 0) {
      setSubmittingChallenge(false);
      alert('This player already has a pending or accepted challenge. Please choose someone else.');
      return;
    }

    await supabase.from('challenges').insert({
      challenger_id: user.id,
      opponent_id: selectedOpponent.user_id,
      ladder_id: membership.ladder_id,
      status: 'pending',
      challenger_rank_at_time: membership.rank,
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
    setSubmittingChallenge(false);
    load();
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
  const hasPendingSent = madePending.length > 0;

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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Challenges</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Full history of challenges made, received, and accepted</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={() => setShowNewChallenge(true)}
            disabled={hasPendingSent}
            className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2 disabled:opacity-50"
          >
            <Swords className="w-4 h-4" />
            Challenge Players
          </Button>
          {hasPendingSent && <p className="text-xs text-muted-foreground">You have a pending challenge</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Received */}
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">Challenges Received</h2>
          </div>
          <div className="divide-y divide-border overflow-y-auto max-h-96">
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
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">Challenges Made</h2>
          </div>
          <div className="divide-y divide-border overflow-y-auto max-h-96">
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
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">Accepted Challenges</h2>
          </div>
          <div className="divide-y divide-border overflow-y-auto max-h-96">
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
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">History</h2>
          </div>
          <div className="divide-y divide-border overflow-y-auto max-h-96">
            {history.map((c) => renderRow(c))}
            {history.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No past challenges yet</div>
            )}
          </div>
        </div>
      </div>

      {/* New Challenge Dialog */}
      <Dialog open={showNewChallenge} onOpenChange={setShowNewChallenge}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send a Challenge</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Opponent</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {eligiblePlayers.map((ep) => {
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
              <Textarea placeholder="Add a friendly message..." value={challengeMsg} onChange={(e) => setChallengeMsg(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowNewChallenge(false)}>Cancel</Button>
              <Button onClick={sendChallenge} disabled={!selectedOpponent || submittingChallenge} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2">
                <Send className="w-4 h-4" />
                {submittingChallenge ? 'Sending...' : 'Send Challenge'}
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
