import { useState, useEffect } from 'react';
import { callApi } from '@/lib/supabaseClient';
import { Search, Users as UsersIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PlayerAvatar from '@/components/PlayerAvatar';
import { getDisplayName } from '@/utils/userHelpers';
import { formatDateOnly } from '@/utils/easternTime';

export default function AdminUsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { users: fetched } = await callApi('/api/admin-list-users', {});
      setUsers((fetched || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return getDisplayName(u)?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-[hsl(217,72%,40%)]" />
            All Users
            <span className="text-sm font-normal text-muted-foreground">({users.length})</span>
          </h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 p-4">{error}</p>}

        <div className="divide-y divide-border">
          {filteredUsers.map(u => (
            <div key={u.id} className="flex items-center gap-4 px-6 py-4">
              <PlayerAvatar user={u} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{getDisplayName(u)}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'} capitalize`}>
                {u.role}
              </span>
              <div className="text-xs text-muted-foreground hidden sm:block w-40">
                {u.ladders.length > 0
                  ? u.ladders.map(l => l.ladder_name).join(', ')
                  : <span className="italic">Not on a ladder</span>}
              </div>
              <div className="text-xs text-muted-foreground hidden md:block w-28">
                {u.city ? `${u.city}, ${u.state || ''}` : '—'}
              </div>
              <div className="text-xs text-muted-foreground hidden lg:block w-24">
                {u.ntrp_rating != null ? `NTRP ${Number(u.ntrp_rating).toFixed(1)}` : '—'}
              </div>
              <div className="text-xs text-muted-foreground w-24 text-right">
                {u.created_at ? formatDateOnly(u.created_at) : '—'}
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
          )}
        </div>
      </div>
    </div>
  );
}
