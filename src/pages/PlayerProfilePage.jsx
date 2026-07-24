import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, getCurrentUser } from '@/lib/supabaseClient';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlayerAvatar from '@/components/PlayerAvatar';
import FreezeStatusBadge from '@/components/FreezeStatusBadge';
import { getDisplayName } from '@/utils/userHelpers';

export default function PlayerProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);
  const [membership, setMembership] = useState(null);
  const [ladder, setLadder] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [userId]);

  const load = async () => {
    setLoading(true);
    setNotFound(false);

    const me = await getCurrentUser();
    if (me?.id === userId) {
      navigate('/profile', { replace: true });
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!profile) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setPlayer(profile);

    const { data: mems } = await supabase.from('ladder_memberships').select('*').match({ user_id: userId });
    if (mems?.length > 0) {
      setMembership(mems[0]);
      const { data: ladders } = await supabase.from('ladders').select('*').match({ id: mems[0].ladder_id });
      if (ladders?.length > 0) setLadder(ladders[0]);
    }
    setLoading(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>
  );

  if (notFound) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-2xl font-bold mb-2">Player not found</h2>
        <p className="text-muted-foreground">This player's profile doesn't exist or has been removed.</p>
      </div>
    );
  }

  const winRate = membership && (membership.wins + membership.losses > 0)
    ? Math.round(membership.wins / (membership.wins + membership.losses) * 100)
    : 0;

  const location = [player.city, player.state].filter(Boolean).join(', ') || player.location;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Player Profile</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
        <div className="h-28 bg-gradient-to-br from-[hsl(217,72%,16%)] to-[hsl(217,50%,28%)]" />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12 mb-4">
            <PlayerAvatar user={player} size="xl" />
            <FreezeStatusBadge status={membership?.status} />
          </div>
          <h2 className="text-xl font-bold">{getDisplayName(player)}</h2>
          {location && <p className="text-sm text-muted-foreground">{location}</p>}

          {membership && (
            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { label: 'Rank', value: `#${membership.rank || '—'}` },
                { label: 'W-L', value: `${membership.wins || 0}-${membership.losses || 0}` },
                { label: 'Win Rate', value: `${winRate}%` },
              ].map(({ label, value }) => (
                <div key={label} className="text-center bg-muted/40 rounded-xl p-3">
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={() => navigate(`/messages?new=${userId}`)}
            className="mt-5 w-full bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Message
          </Button>
        </div>
      </div>

      {/* Player details */}
      <div className="bg-white rounded-2xl shadow-sm border border-border p-6 mb-6">
        <h3 className="font-bold mb-4">Player Details</h3>
        <div className="space-y-3">
          {player.gender && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Gender</span><span className="font-medium">{player.gender}</span></div>}
          {player.playing_style && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Playing Style</span><span className="font-medium">{player.playing_style}</span></div>}
          {player.favorite_surface && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Favorite Surface</span><span className="font-medium">{player.favorite_surface}</span></div>}
          {player.bio && <p className="text-sm text-muted-foreground pt-1">{player.bio}</p>}
          {!player.gender && !player.playing_style && !player.favorite_surface && !player.bio && (
            <p className="text-sm text-muted-foreground">No additional details yet.</p>
          )}
        </div>
      </div>

      {/* Membership */}
      {membership && (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
          <h3 className="font-bold mb-4">Membership</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Ladder</span><span className="font-medium">{ladder?.name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
              <span className={`font-semibold capitalize ${
                membership.status === 'active' ? 'text-green-600' : 'text-amber-600'
              }`}>{membership.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
