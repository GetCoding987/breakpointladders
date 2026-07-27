import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, getCurrentUser, callApi } from '@/lib/supabaseClient';
import { Trophy, Activity, TrendingUp, Swords, Clock, CheckCircle, XCircle, AlertCircle, Snowflake, Send, MessageSquare } from 'lucide-react';
import StatCard from '@/components/StatCard';
import PlayerAvatar from '@/components/PlayerAvatar';
import RankBadge from '@/components/RankBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getDisplayName } from '@/utils/userHelpers';
import { formatEasternDate, formatDateOnly } from '@/utils/easternTime';
import PlayerHoverCard from '@/components/PlayerHoverCard';

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [topPlayers, setTopPlayers] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [eligiblePlayers, setEligiblePlayers] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [loading, setLoading] = useState(true);

  // New Challenge dialog
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [challengeMsg, setChallengeMsg] = useState('');
  const [submittingChallenge, setSubmittingChallenge] = useState(false);

  // Decline dialog
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Auto-open the New Challenge popup when arriving via a "Challenge" link elsewhere
  useEffect(() => {
    const opponentId = searchParams.get('challengeOpponent');
    if (opponentId && eligiblePlayers.length > 0) {
      const op = eligiblePlayers.find((p) => p.user_id === opponentId);
      if (op) { setSelectedOpponent(op); setShowNewChallenge(true); }
    }
  }, [searchParams, eligiblePlayers]);

  const loadDashboard = async () => {
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

    // Top 10 on this ladder
    const { data: allMemberships } = await supabase.from('ladder_memberships').select('*').match({ ladder_id: mem.ladder_id });
    const sorted = [...allMemberships].sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 10);

    // Build user map from memberships (User.list() is admin-only, use memberships instead)
    const userMap = {};
    allMemberships.forEach((m) => {
      const existing = userMap[m.user_id] || {};
      userMap[m.user_id] = {
        ...existing,
        id: m.user_id,
        full_name: m.display_name,
        avatar_url: m.avatar_url,
        location: m.location,
        playing_style: m.playing_style,
        favorite_surface: m.favorite_surface
      };
    });
    // Membership location can be blank if it predates the field being captured —
    // backfill from each player's profile so location shows for everyone, not just "You".
    // Also pull city/gender/ntrp_rating for the hover-preview card.
    const memberIds = allMemberships.map((m) => m.user_id);
    const { data: memberProfiles } = await supabase.from('profiles').select('id, location, city, state, gender, ntrp_rating').in('id', memberIds);
    (memberProfiles || []).forEach((p) => {
      if (userMap[p.id]) {
        if (!userMap[p.id].location) {
          userMap[p.id].location = [p.city, p.state].filter(Boolean).join(', ') || p.location;
        }
        userMap[p.id].city = p.city;
        userMap[p.id].gender = p.gender;
        userMap[p.id].ntrp_rating = p.ntrp_rating;
      }
    });
    userMap[u.id] = { ...userMap[u.id], ...u, location: userMap[u.id]?.location || u.location };
    setAllUsers(userMap);
    setTopPlayers(sorted);

    // Challenges involving me (any status) — powers the Challenges Received/Made/Accepted sections
    const { data: allChallenges } = await supabase.from('challenges').select('*').match({ ladder_id: mem.ladder_id });
    const mine = (allChallenges || []).filter((c) => c.challenger_id === u.id || c.opponent_id === u.id);
    setChallenges(mine.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));

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
    const eligible = allMemberships.filter((m) => {
      if (m.user_id === u.id || m.status !== 'active' || busyUserIds.has(m.user_id)) return false;
      const targetRank = m.rank || 999;
      if (targetRank < myRank) return (myRank - targetRank) <= rankWindow;
      if (isTop5 && targetRank > myRank) return (targetRank - myRank) <= 10;
      return false;
    });
    setEligiblePlayers(eligible.sort((a, b) => (a.rank || 999) - (b.rank || 999)));

    // Recent matches
    const { data: matches } = await supabase.from('matches').select('*').match({ ladder_id: mem.ladder_id });
    const myMatches = (matches || []).filter((m) =>
    m.player1_id === u.id || m.player2_id === u.id
    ).sort((a, b) => new Date(b.played_date) - new Date(a.played_date)).slice(0, 3);
    setRecentMatches(myMatches);

    // Recent messages
    const { data: msgs } = await supabase.from('messages').select('*').match({ recipient_id: u.id });
    setMessages((msgs || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 3));

    // Announcements
    const { data: anns } = await supabase.from('announcements').select('*').match({ ladder_id: mem.ladder_id });
    setAnnouncements((anns || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 3));

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
    loadDashboard();
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
    loadDashboard();
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
    loadDashboard();
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
    loadDashboard();
  };

  const messageOpponent = (challenge) => {
    const otherId = challenge.challenger_id === user?.id ? challenge.opponent_id : challenge.challenger_id;
    navigate(`/messages?new=${otherId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
      </div>);

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
      </div>);

  }

  const winRate = membership.wins + membership.losses > 0 ?
  Math.round(membership.wins / (membership.wins + membership.losses) * 100) :
  0;

  const isFrozen = membership.status === 'frozen_voluntary' || membership.status === 'frozen_expired' || membership.status === 'frozen_no_response';

  const receivedPending = challenges.filter((c) => c.status === 'pending' && c.opponent_id === user?.id);
  const madePending = challenges.filter((c) => c.status === 'pending' && c.challenger_id === user?.id);
  const acceptedChallenges = challenges.filter((c) => c.status === 'accepted');
  const hasPendingSent = madePending.length > 0;

  return (
    <div className="p-3 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Welcome back, {getDisplayName(user)?.split(' ')[0]}!</p>
        </div>
        <div className="flex items-center gap-3">
          {isFrozen &&
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">
              <Snowflake className="w-4 h-4" />
              Account Frozen
            </div>
          }
          {!isFrozen &&
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
          }
        </div>
      </div>

      {/* Membership expiry warning */}
      {membership.membership_expires && new Date(membership.membership_expires) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) &&
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Membership Expiring Soon</p>
            <p className="text-amber-700 text-xs">
              Your membership expires on {formatDateOnly(membership.membership_expires)}.
              <Link to="/profile" className="underline ml-1">Renew now</Link>
            </p>
          </div>
        </div>
      }

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        <StatCard icon={Trophy} label="Ladder Rank" value={`#${membership.rank || '—'}`}
        sub={`${membership.wins || 0}-${membership.losses || 0} record`} color="navy" />
        <StatCard icon={Activity} label="Matches Played" value={membership.wins + membership.losses}
        sub={`W: ${membership.wins} / L: ${membership.losses}`} color="green" />
        <StatCard icon={TrendingUp} label="Win Rate" value={`${winRate}%`} color="yellow" />
        <StatCard icon={Swords} label="Pending Challenges" value={receivedPending.length + madePending.length}
        sub="Respond within 48h" color="orange" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Ladder top 10 */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm text-foreground">Ladder Top 10</h2>
            <Link to="/ladder" className="text-xs text-[hsl(142,50%,45%)] font-semibold hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-border">
            {topPlayers.map((mem) => {
              const memberUser = allUsers[mem.user_id];
              const isMe = mem.user_id === user?.id;
              return (
                <PlayerHoverCard key={mem.id} user={memberUser}>
                  <Link
                    to={isMe ? '/profile' : `/players/${mem.user_id}`}
                    className={`flex items-center gap-2 px-3 py-2 ${isMe ? 'bg-blue-50' : 'hover:bg-muted/30'} transition-colors`}
                  >
                    <RankBadge rank={mem.rank} size="sm" />
                    <PlayerAvatar user={memberUser} size="xs" showStatus status={mem.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {getDisplayName(memberUser)}
                        {isMe && <span className="text-blue-600 ml-1">(You)</span>}
                      </p>
                      {memberUser?.location && (
                        <p className="text-[10px] text-muted-foreground truncate">{memberUser.location}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{mem.wins || 0}-{mem.losses || 0}</p>
                    </div>
                  </Link>
                </PlayerHoverCard>);

            })}
            {topPlayers.length === 0 &&
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">No players yet</div>
            }
          </div>
        </div>

        {/* Middle column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Challenges */}
          <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-sm text-foreground">Challenges</h2>
            </div>
            <div className="p-3 space-y-4">
              {/* Received */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Challenges Received</p>
                <div className="space-y-2">
                  {receivedPending.map((c) => {
                    const otherUser = allUsers[c.challenger_id];
                    const hoursLeft = c.created_date ? Math.max(0, 48 - Math.floor((Date.now() - new Date(c.created_date)) / 3600000)) : 48;
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <PlayerAvatar user={otherUser} size="xs" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">Challenged by {getDisplayName(otherUser)}</p>
                          <div className={`text-[10px] font-bold flex items-center gap-1 ${hoursLeft < 24 ? 'text-red-500' : 'text-amber-500'}`}>
                            <Clock className="w-3 h-3" />
                            {hoursLeft}h left to respond
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <Button size="sm" onClick={() => acceptChallenge(c)} className="bg-green-600 hover:bg-green-700 h-7 text-xs px-2">
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openDecline(c)} className="h-7 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50">
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {receivedPending.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
                </div>
              </div>

              {/* Made */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Challenges Made</p>
                <div className="space-y-2">
                  {madePending.map((c) => {
                    const otherUser = allUsers[c.opponent_id];
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <PlayerAvatar user={otherUser} size="xs" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">You challenged {getDisplayName(otherUser)}</p>
                          <p className="text-[10px] text-muted-foreground">Awaiting response</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => cancelChallenge(c)} className="h-7 text-xs px-2 flex-shrink-0">
                          Cancel
                        </Button>
                      </div>
                    );
                  })}
                  {madePending.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
                </div>
              </div>

              {/* Accepted */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Accepted Challenges</p>
                <div className="space-y-2">
                  {acceptedChallenges.map((c) => {
                    const isChallenger = c.challenger_id === user?.id;
                    const otherUser = allUsers[isChallenger ? c.opponent_id : c.challenger_id];
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <PlayerAvatar user={otherUser} size="xs" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">vs {getDisplayName(otherUser)}</p>
                          <p className="text-[10px] text-muted-foreground">Scheduled — awaiting match</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <Button size="sm" asChild className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] h-7 text-xs px-2">
                            <Link to={`/matches?challenge=${c.id}`}>Submit</Link>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => messageOpponent(c)} className="h-7 text-xs px-2">
                            <MessageSquare className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {acceptedChallenges.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Matches */}
          <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm text-foreground">Recent Matches</h2>
              <Link to="/matches" className="text-xs text-[hsl(142,50%,45%)] font-semibold hover:underline">View All</Link>
            </div>
            <div className="divide-y divide-border">
              {recentMatches.map((m) => {
                const opponentId = m.player1_id === user?.id ? m.player2_id : m.player1_id;
                const opponent = allUsers[opponentId];
                const won = m.winner_id === user?.id;
                return (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                    <PlayerAvatar user={opponent} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{getDisplayName(user)} vs {getDisplayName(opponent)}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.played_date ? formatDateOnly(m.played_date) : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold">{m.score || '—'}</p>
                      <p className={`text-xs font-semibold ${won ? 'text-green-600' : 'text-red-500'}`}>
                        {m.status === 'pending_confirmation' ?
                        <span className="text-amber-500">Pending</span> :
                        won ? 'Win' : 'Loss'}
                      </p>
                    </div>
                  </div>);

              })}
              {recentMatches.length === 0 &&
              <div className="px-4 py-5 text-center text-xs text-muted-foreground">No matches yet</div>
              }
            </div>
          </div>
        </div>

        {/* Right column — Profile + Messages */}
        <div className="lg:col-span-1 space-y-4">
          {/* Announcements */}
          <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-sm text-foreground">Announcements</h2>
            </div>
            <div className="divide-y divide-border">
              {announcements.map((ann) => (
                <div key={ann.id} className="px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">{ann.title}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ann.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {ann.created_date ? formatEasternDate(ann.created_date) : ''}
                  </p>
                </div>
              ))}
              {announcements.length === 0 &&
              <div className="px-4 py-5 text-center text-xs text-muted-foreground">No announcements</div>
              }
            </div>
          </div>

          {/* Recent messages */}
          <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm text-foreground">Messages</h2>
              <Link to="/messages" className="text-xs text-[hsl(142,50%,45%)] font-semibold hover:underline">View All</Link>
            </div>
            <div className="divide-y divide-border">
              {messages.map((msg) => {
                const sender = allUsers[msg.sender_id];
                return (
                  <Link key={msg.id} to="/messages" className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors">
                    <PlayerAvatar user={sender} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold truncate">{getDisplayName(sender)}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {msg.created_date && <span className="text-[10px] text-muted-foreground">{formatEasternDate(msg.created_date)}</span>}
                          {!msg.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{msg.content}</p>
                    </div>
                  </Link>);

              })}
              {messages.length === 0 &&
              <div className="px-4 py-5 text-center text-xs text-muted-foreground">No messages</div>
              }
            </div>
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
    </div>);

}
