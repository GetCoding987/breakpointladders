import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, getCurrentUser } from '@/lib/supabaseClient';
import { Trophy, Activity, TrendingUp, Swords, Clock, CheckCircle, AlertCircle, Snowflake } from 'lucide-react';
import StatCard from '@/components/StatCard';
import PlayerAvatar from '@/components/PlayerAvatar';
import RankBadge from '@/components/RankBadge';
import FreezeStatusBadge from '@/components/FreezeStatusBadge';
import { Button } from '@/components/ui/button';
import { getDisplayName } from '@/utils/userHelpers';
import { formatEasternDate, formatEasternDateFull, formatDateOnly } from '@/utils/easternTime';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [ladder, setLadder] = useState(null);
  const [topPlayers, setTopPlayers] = useState([]);
  const [pendingChallenges, setPendingChallenges] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

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

    const { data: ladders } = await supabase.from('ladders').select('*').match({ id: mem.ladder_id });
    if (ladders?.length > 0) setLadder(ladders[0]);

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
    // Also add current user with location from membership if available
    const currentUserMem = allMemberships.find(m => m.user_id === u.id);
    userMap[u.id] = {
      ...u,
      location: currentUserMem?.location || u.location
    };
    setAllUsers(userMap);
    setTopPlayers(sorted);

    // Pending challenges - only show challenges awaiting response (not accepted ones)
    const { data: challenges } = await supabase.from('challenges').select('*').match({ ladder_id: mem.ladder_id });
    const pending = (challenges || []).filter((c) =>
    (c.opponent_id === u.id && c.status === 'pending')
    );
    setPendingChallenges(pending.slice(0, 3));

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

  const isFrozen = membership.status === 'frozen_voluntary' || membership.status === 'frozen_expired';

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
          <Button asChild className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2">
              <Link to="/challenges">
                <Swords className="w-4 h-4" />
                Challenge Players
              </Link>
            </Button>
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
        <StatCard icon={Swords} label="Pending Challenges" value={pendingChallenges.length}
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
                <div key={mem.id} className={`flex items-center gap-2 px-3 py-2 ${isMe ? 'bg-blue-50' : 'hover:bg-muted/30'} transition-colors`}>
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
                  
                </div>);

            })}
            {topPlayers.length === 0 &&
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">No players yet</div>
            }
          </div>
        </div>

        {/* Middle column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Pending Challenges */}
          <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm text-foreground">Pending Challenges</h2>
              <Link to="/challenges" className="text-xs text-[hsl(142,50%,45%)] font-semibold hover:underline">View All</Link>
            </div>
            <div className="divide-y divide-border">
              {pendingChallenges.map((c) => {
                const isChallenger = c.challenger_id === user?.id;
                const otherUserId = isChallenger ? c.opponent_id : c.challenger_id;
                const otherUser = allUsers[otherUserId];
                const hoursLeft = c.created_date ?
                Math.max(0, 72 - Math.floor((Date.now() - new Date(c.created_date)) / 3600000)) :
                72;
                return (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                    <PlayerAvatar user={otherUser} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">
                        {isChallenger ? 'You challenged' : 'Challenged by'} {getDisplayName(otherUser)}
                      </p>
                      <p className="text-xs text-muted-foreground">Rank #{isChallenger ? c.opponent_rank_at_time : c.challenger_rank_at_time}</p>
                    </div>
                    <div className={`text-xs font-bold flex items-center gap-1 ${hoursLeft < 24 ? 'text-red-500' : 'text-amber-500'}`}>
                      <Clock className="w-3 h-3" />
                      {hoursLeft}h
                    </div>
                  </div>);

              })}
              {pendingChallenges.length === 0 &&
              <div className="px-4 py-5 text-center text-xs text-muted-foreground">No pending challenges</div>
              }
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
                  <p className="text-xs text-muted-foreground line-clamp-2">{ann.body}</p>
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
    </div>);

}