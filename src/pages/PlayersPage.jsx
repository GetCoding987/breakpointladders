import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, getCurrentUser } from '@/lib/supabaseClient';
import { Search, MessageSquare, Swords } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PlayerAvatar from '@/components/PlayerAvatar';
import RankBadge from '@/components/RankBadge';
import FreezeStatusBadge from '@/components/FreezeStatusBadge';
import { getDisplayName } from '@/utils/userHelpers';

export default function PlayersPage() {
  const [user, setUser] = useState(null);
  const [myMembership, setMyMembership] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {load();}, []);

  const load = async () => {
    setLoading(true);
    const u = await getCurrentUser();
    setUser(u);

    const { data: mems } = await supabase.from('ladder_memberships').select('*').match({ user_id: u.id });
    if (mems?.length > 0) {
      setMyMembership(mems[0]);
      const { data: allMems } = await supabase.from('ladder_memberships').select('*').match({ ladder_id: mems[0].ladder_id });
      setMemberships(allMems.sort((a, b) => (a.rank || 999) - (b.rank || 999)));
      // Build user map from memberships (no admin User.list() needed)
      const map = {};
      allMems.forEach((m) => {
        map[m.user_id] = { id: m.user_id, full_name: m.display_name, avatar_url: m.avatar_url, location: m.location, playing_style: m.playing_style, favorite_surface: m.favorite_surface };
      });
      map[u.id] = u;
      setAllUsers(map);
    }
    setLoading(false);
  };

  const canChallenge = (targetMem) => {
    if (!myMembership) return false;
    if (myMembership.status !== 'active') return false;
    if (targetMem.user_id === user?.id) return false;
    if (targetMem.status !== 'active') return false;
    const myRank = myMembership.rank || 999;
    const targetRank = targetMem.rank || 999;
    return targetRank < myRank && myRank - targetRank <= 10;
  };

  const filtered = memberships.filter((m) => {
    if (!search) return true;
    const u = allUsers[m.user_id];
    return getDisplayName(u)?.toLowerCase().includes(search.toLowerCase()) ||
    u?.location?.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>);


  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{memberships.length} players on this ladder</p>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search players by name or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white" />
        
      </div>

      <div className="grid gap-3">
        {filtered.map((mem) => {
          const memberUser = allUsers[mem.user_id];
          const isMe = mem.user_id === user?.id;
          const winRate = mem.wins + mem.losses > 0 ?
          Math.round(mem.wins / (mem.wins + mem.losses) * 100) :
          0;

          return (
            <div key={mem.id} className={`bg-white rounded-2xl border border-border p-5 shadow-sm transition-all hover:shadow-md ${isMe ? 'border-l-4 border-l-blue-500' : ''}`}>
              <div className="flex items-center gap-4">
                <RankBadge rank={mem.rank} size="md" />
                <PlayerAvatar user={memberUser} size="lg" showStatus status={mem.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base">
                      {getDisplayName(memberUser)}
                      {isMe && <span className="text-blue-500 text-xs ml-1">(You)</span>}
                    </h3>
                    <FreezeStatusBadge status={mem.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {memberUser?.location && <span>📍 {memberUser.location}</span>}
                    {memberUser?.playing_style && <span>🎾 {memberUser.playing_style}</span>}
                    {memberUser?.favorite_surface && <span>🏟️ {memberUser.favorite_surface}</span>}
                  </div>
                </div>
                <div className="hidden sm:grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="font-bold text-sm">{mem.wins || 0}-{mem.losses || 0}</p>
                    <p className="text-xs text-muted-foreground">W-L</p>
                  </div>
                  <div>
                    <p className="font-bold text-sm">{winRate}%</p>
                    <p className="text-xs text-muted-foreground">Win%</p>
                  </div>
                </div>
                {!isMe &&
                <div className="flex gap-2 flex-shrink-0">
                    <Link to={`/messages`}>
                      <Button size="sm" variant="outline" className="h-9 px-3">
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </Link>
                    {canChallenge(mem) &&
                  <Link to={`/challenges/new?opponent=${mem.user_id}`}>
                        <Button size="sm" className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] h-9 px-3 gap-1 text-xs">
                          <Swords className="w-3.5 h-3.5" />
                          Challenge
                        </Button>
                      </Link>
                  }
                  </div>
                }
              </div>
            </div>);

        })}
        {filtered.length === 0 &&
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">
            No players found
          </div>
        }
      </div>
    </div>);

}