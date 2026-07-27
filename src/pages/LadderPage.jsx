import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, getCurrentUser } from '@/lib/supabaseClient';
import { Trophy, Search, Swords, Snowflake, CreditCard, MapPin, MessageSquare, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RankBadge from '@/components/RankBadge';
import PlayerAvatar from '@/components/PlayerAvatar';
import FreezeStatusBadge from '@/components/FreezeStatusBadge';
import { getDisplayName } from '@/utils/userHelpers';
import { useNavigate } from 'react-router-dom';
import PlayerHoverCard from '@/components/PlayerHoverCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';

export default function LadderPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [myMembership, setMyMembership] = useState(null);
  const [ladders, setLadders] = useState([]);
  const [selectedLadder, setSelectedLadder] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [streaks, setStreaks] = useState({});
  const [movements, setMovements] = useState({});
  const [pendingChallenges, setPendingChallenges] = useState({});
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const u = await getCurrentUser();
    setUser(u);

    const { data: allLadders } = await supabase.from('ladders').select('*').match({ status: 'active' });
    setLadders(allLadders || []);

    const { data: myMems } = await supabase.from('ladder_memberships').select('*').match({ user_id: u.id });
    if (myMems?.length > 0) {
      setMyMembership(myMems[0]);
      const first = allLadders.find(l => l.id === myMems[0].ladder_id) || allLadders[0];
      if (first) loadLadder(first, myMems[0]);
    } else if (allLadders?.length > 0) {
      loadLadder(allLadders[0], null);
    }

    setLoading(false);
  };

  const loadLadder = async (ladder, myMem) => {
    setSelectedLadder(ladder);
    const { data: mems } = await supabase.from('ladder_memberships').select('*').match({ ladder_id: ladder.id });
    const sorted = [...(mems || [])].sort((a, b) => (a.rank || 999) - (b.rank || 999));
    setMemberships(sorted);

    // Build user map from memberships (no admin User.list() needed)
    const map = {};
    (mems || []).forEach(m => {
      map[m.user_id] = { id: m.user_id, full_name: m.display_name, avatar_url: m.avatar_url, location: m.location, playing_style: m.playing_style, favorite_surface: m.favorite_surface };
    });
    // Membership location can be blank if it predates the field being captured —
    // backfill from each player's profile so location shows for everyone. Also
    // pull city/gender/ntrp_rating for the hover-preview card.
    const memberIds = (mems || []).map(m => m.user_id);
    if (memberIds.length > 0) {
      const { data: memberProfiles } = await supabase.from('profiles').select('id, location, city, state, gender, ntrp_rating').in('id', memberIds);
      (memberProfiles || []).forEach(p => {
        if (map[p.id]) {
          if (!map[p.id].location) {
            map[p.id].location = [p.city, p.state].filter(Boolean).join(', ') || p.location;
          }
          map[p.id].city = p.city;
          map[p.id].gender = p.gender;
          map[p.id].ntrp_rating = p.ntrp_rating;
        }
      });
    }
    setAllUsers(map);

    // Streak + Movement: derived from each player's confirmed match history
    // (oldest to newest), since the app only stores current rank, not history.
    const { data: allMatches } = await supabase.from('matches').select('*')
      .match({ ladder_id: ladder.id, status: 'confirmed' });
    const sortedMatches = (allMatches || []).sort((a, b) => new Date(a.played_date) - new Date(b.played_date));

    const { data: allChallenges } = await supabase.from('challenges').select('*').match({ ladder_id: ladder.id });
    const challengeById = {};
    (allChallenges || []).forEach(c => { challengeById[c.id] = c; });

    const streakMap = {};
    const movementMap = {};
    (mems || []).forEach(m => {
      const playerMatches = sortedMatches.filter(match => match.player1_id === m.user_id || match.player2_id === m.user_id);
      // Streak: consecutive wins or losses ending with the most recent match
      let streakCount = 0;
      let streakType = null;
      for (let i = playerMatches.length - 1; i >= 0; i--) {
        const won = playerMatches[i].winner_id === m.user_id;
        const type = won ? 'W' : 'L';
        if (streakType === null) streakType = type;
        if (type !== streakType) break;
        streakCount++;
      }
      streakMap[m.user_id] = streakType ? { type: streakType, count: streakCount } : null;

      // Movement: compare current rank to the rank recorded at the time of
      // the most recent match's underlying challenge (if any).
      const lastMatch = playerMatches[playerMatches.length - 1];
      const lastChallenge = lastMatch?.challenge_id ? challengeById[lastMatch.challenge_id] : null;
      if (lastChallenge) {
        const rankAtTime = lastMatch.player1_id === m.user_id
          ? lastChallenge.challenger_rank_at_time
          : lastChallenge.opponent_rank_at_time;
        if (rankAtTime != null && m.rank != null) {
          if (m.rank < rankAtTime) movementMap[m.user_id] = 'up';
          else if (m.rank > rankAtTime) movementMap[m.user_id] = 'down';
          else movementMap[m.user_id] = 'neutral';
        } else {
          movementMap[m.user_id] = 'neutral';
        }
      } else {
        movementMap[m.user_id] = 'neutral';
      }
    });
    setStreaks(streakMap);
    setMovements(movementMap);

    // Challenge Pending: any pending challenge involving this player
    const pendingMap = {};
    (allChallenges || []).forEach(c => {
      if (c.status !== 'pending') return;
      if (!pendingMap[c.challenger_id]) pendingMap[c.challenger_id] = c.opponent_id;
      if (!pendingMap[c.opponent_id]) pendingMap[c.opponent_id] = c.challenger_id;
    });
    setPendingChallenges(pendingMap);
  };

  const filtered = memberships.filter(m => {
    if (m.status === 'inactive') return false;
    const u = allUsers[m.user_id];
    const nameMatch = !search || getDisplayName(u)?.toLowerCase().includes(search.toLowerCase());
    const cityMatch = !cityFilter || u?.location?.toLowerCase().includes(cityFilter.toLowerCase());
    return nameMatch && cityMatch;
  });

  const canChallenge = (targetMembership) => {
    if (!myMembership || !selectedLadder) return false;
    if (myMembership.status !== 'active') return false;
    if (targetMembership.user_id === user?.id) return false;
    if (targetMembership.status !== 'active') return false;
    const myRank = myMembership.rank || 999;
    const targetRank = targetMembership.rank || 999;
    const window = selectedLadder.challenge_window_spots || 10;
    if (targetRank < myRank) return (myRank - targetRank) <= window;
    // Top 5 players can also challenge up to 10 spots below them
    if (myRank <= 5 && targetRank > myRank) return (targetRank - myRank) <= 10;
    return false;
  };

  const messagePlayer = (userId) => {
    navigate(`/messages?new=${userId}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-3 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ladder Standings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {selectedLadder ? selectedLadder.name : 'Select a ladder'}
          </p>
        </div>
        {/* Ladder selector */}
        {ladders.length > 1 && (
          <Select
            value={selectedLadder?.id || ''}
            onValueChange={val => {
              const ladder = ladders.find(l => l.id === val);
              if (ladder) loadLadder(ladder, myMembership);
            }}
          >
            <SelectTrigger className="w-full sm:w-auto sm:min-w-[320px]">
              <SelectValue placeholder="Select a ladder" />
            </SelectTrigger>
            <SelectContent>
              {ladders.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!myMembership && (
        <div className="mb-6 p-5 bg-[hsl(217,72%,16%)] text-white rounded-2xl flex items-center justify-between">
          <div>
            <p className="font-bold">Join this Ladder</p>
            <p className="text-white/70 text-sm">Pay the annual fee to compete</p>
          </div>
          <Button asChild className="bg-white text-[hsl(217,72%,16%)] hover:bg-white/90">
            <Link to="/join">
              <CreditCard className="w-4 h-4 mr-2" />
              Join — ${selectedLadder?.annual_fee || 25}/season
            </Link>
          </Button>
        </div>
      )}

      {/* Search + City filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <div className="relative sm:w-48">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter by city..."
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Ladder table */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="hidden md:grid grid-cols-[repeat(20,minmax(0,1fr))] px-6 py-3 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-1">Rank</div>
          <div className="col-span-5">Player</div>
          <div className="col-span-2 text-center">W-L</div>
          <div className="col-span-2 text-center">Streak</div>
          <div className="col-span-2 text-center">Movement</div>
          <div className="col-span-3 text-center">Challenge Pending</div>
          <div className="col-span-5 text-right">Action</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((mem) => {
            const memberUser = allUsers[mem.user_id];
            const isMe = mem.user_id === user?.id;
            const challengeable = canChallenge(mem);
            const streak = streaks[mem.user_id];
            const movement = movements[mem.user_id];
            const pendingOpponentId = pendingChallenges[mem.user_id];
            const pendingOpponent = pendingOpponentId ? allUsers[pendingOpponentId] : null;

            return (
              <div
                key={mem.id}
                className={`px-4 md:px-6 py-3.5 transition-colors ${
                  isMe ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-muted/20'
                }`}
              >
                <div className="flex flex-col gap-2 md:grid md:grid-cols-[repeat(20,minmax(0,1fr))] md:items-center md:gap-0">
                  {/* Top row on mobile: rank + player + W-L */}
                  <div className="flex items-center gap-3 md:contents">
                    <div className="md:col-span-1 shrink-0">
                      <RankBadge rank={mem.rank} size="sm" />
                    </div>
                    <PlayerHoverCard user={memberUser}>
                      <Link
                        to={isMe ? '/profile' : `/players/${mem.user_id}`}
                        className="flex items-center gap-3 md:col-span-5 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                      >
                        <PlayerAvatar user={memberUser} size="sm" showStatus status={mem.status} />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {getDisplayName(memberUser)}
                            {isMe && <span className="text-blue-500 text-xs ml-1">(You)</span>}
                          </p>
                          <div className="flex items-center gap-2">
                            {memberUser?.location && (
                              <p className="text-xs text-muted-foreground truncate">{memberUser.location}</p>
                            )}
                            <FreezeStatusBadge status={mem.status} />
                          </div>
                        </div>
                      </Link>
                    </PlayerHoverCard>
                    <div className="md:col-span-2 shrink-0 md:text-center">
                      <span className="text-sm font-medium text-green-600">{mem.wins || 0}</span>
                      <span className="text-muted-foreground mx-1">-</span>
                      <span className="text-sm font-medium text-red-500">{mem.losses || 0}</span>
                    </div>
                  </div>

                  {/* Streak */}
                  <div className="md:col-span-2 md:text-center">
                    {streak ? (
                      <span className={`text-sm font-semibold ${streak.type === 'W' ? 'text-green-600' : 'text-red-500'}`}>
                        {streak.type}{streak.count}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Movement */}
                  <div className="md:col-span-2 md:flex md:justify-center">
                    {movement === 'up' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                        <ArrowUp className="w-3.5 h-3.5" /> Up
                      </span>
                    ) : movement === 'down' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500">
                        <ArrowDown className="w-3.5 h-3.5" /> Down
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Minus className="w-3.5 h-3.5" /> Neutral
                      </span>
                    )}
                  </div>

                  {/* Challenge Pending */}
                  <div className="md:col-span-3 md:flex md:justify-center">
                    {pendingOpponent ? (
                      <HoverCard openDelay={150}>
                        <HoverCardTrigger asChild>
                          <span className="text-xs font-semibold text-amber-600 cursor-default underline decoration-dotted underline-offset-2">
                            Yes
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-56 text-sm">
                          Pending challenge with <strong>{getDisplayName(pendingOpponent)}</strong>
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </div>

                  {/* Action buttons — on mobile: full-width row below; on desktop: col-span-5 */}
                  <div className="flex justify-end gap-2 md:col-span-5">
                    {challengeable ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => messagePlayer(mem.user_id)} className="h-8 text-xs gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Message
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => navigate(`/?challengeOpponent=${mem.user_id}`)}
                          className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] h-8 text-xs gap-1"
                        >
                          <Swords className="w-3 h-3" />
                          Challenge
                        </Button>
                      </>
                    ) : isMe ? (
                      <span className="text-xs text-muted-foreground">You</span>
                    ) : mem.status !== 'active' ? (
                      <span className="text-xs text-muted-foreground">
                        {mem.status === 'frozen_voluntary' ? <Snowflake className="w-4 h-4 text-blue-400" /> : 'Frozen'}
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => messagePlayer(mem.user_id)} className="h-8 text-xs gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Message
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-muted-foreground">
              <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No players found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}