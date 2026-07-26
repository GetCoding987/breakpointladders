import { useState, useEffect } from 'react';
import { supabase, callApi } from '@/lib/supabaseClient';
import { Search, Users as UsersIcon, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PlayerAvatar from '@/components/PlayerAvatar';
import { getDisplayName } from '@/utils/userHelpers';
import { formatDateOnly } from '@/utils/easternTime';

export default function AdminUsersTab({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleChangingId, setRoleChangingId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  const toggleRole = async (u) => {
    const newRole = u.role === 'admin' ? 'player' : 'admin';
    const verb = newRole === 'admin' ? 'grant admin privileges to' : 'revoke admin privileges from';
    if (!window.confirm(`Are you sure you want to ${verb} ${getDisplayName(u)}?`)) return;

    setRoleChangingId(u.id);
    const { error: updateError } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id);
    if (updateError) {
      alert(`Failed to update role: ${updateError.message}`);
    } else {
      setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, role: newRole } : usr));
    }
    setRoleChangingId(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await callApi('/api/admin-delete-user', { target_user_id: deleteTarget.id });
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
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
    <div className="max-w-5xl mx-auto w-full">
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
          {filteredUsers.map(u => {
            const isSelf = u.id === currentUserId;
            return (
              <div key={u.id} className="flex items-center gap-4 px-6 py-4">
                <PlayerAvatar user={u} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{getDisplayName(u)}{isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}</p>
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
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSelf || roleChangingId === u.id}
                    onClick={() => toggleRole(u)}
                    className="h-8 text-xs gap-1"
                    title={isSelf ? "You can't change your own role here" : undefined}
                  >
                    {u.role === 'admin' ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {u.role === 'admin' ? 'Make Player' : 'Make Admin'}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isSelf}
                    onClick={() => { setDeleteTarget(u); setDeleteError(''); }}
                    className="h-8 w-8 text-red-600 hover:bg-red-50"
                    title={isSelf ? "Use Delete My Account on your Profile page" : undefined}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {filteredUsers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to permanently delete <strong>{deleteTarget ? getDisplayName(deleteTarget) : ''}</strong>?
            </p>
            <p className="text-sm text-red-600 font-medium">
              This permanently deletes their account, profile, ladder membership, messages, challenges, and match data. This cannot be undone.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete User'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
