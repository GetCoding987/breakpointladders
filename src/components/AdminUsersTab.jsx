import { useState, useEffect } from 'react';
import { supabase, callApi } from '@/lib/supabaseClient';
import { Search, Users as UsersIcon, Pencil, Trash2, Phone, User, Trophy, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CityAutocomplete from '@/components/CityAutocomplete';
import PlayerAvatar from '@/components/PlayerAvatar';
import { NtrpRatingSelect } from '@/components/NtrpRatingField';
import { getDisplayName, toSentenceCase } from '@/utils/userHelpers';
import { formatDateOnly } from '@/utils/easternTime';

const emptyForm = { first_name: '', last_name: '', gender: '', city: '', phone: '', ntrp_rating: '', role: 'player' };

export default function AdminUsersTab({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [ladders, setLadders] = useState([]);
  const [addLadderId, setAddLadderId] = useState('');
  const [addingLadder, setAddingLadder] = useState(false);
  const [addLadderError, setAddLadderError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ users: fetched }, { data: allLadders }] = await Promise.all([
        callApi('/api/admin-list-users', {}),
        supabase.from('ladders').select('*').match({ status: 'active' }),
      ]);
      setUsers((fetched || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setLadders(allLadders || []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (u) => {
    setEditTarget(u);
    setForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      gender: u.gender || '',
      city: u.city || '',
      phone: u.phone || '',
      ntrp_rating: u.ntrp_rating != null ? Number(u.ntrp_rating).toFixed(1) : '',
      role: u.role || 'player',
    });
    setFormError('');
    setAddLadderId('');
    setAddLadderError('');
  };

  const saveEdit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError('First and last name are required');
      return;
    }
    setSaving(true);
    setFormError('');

    const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`;
    const location = form.city ? `${form.city}, New York` : null;
    const { error: updateError } = await supabase.from('profiles').update({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      gender: form.gender || null,
      city: form.city || null,
      state: form.city ? 'New York' : null,
      location,
      phone: form.phone.trim() || null,
      ntrp_rating: form.ntrp_rating ? parseFloat(form.ntrp_rating) : null,
      role: form.role,
    }).eq('id', editTarget.id);

    if (updateError) {
      setFormError(updateError.message);
      setSaving(false);
      return;
    }

    if (editTarget.ladders.length > 0) {
      await supabase.from('ladder_memberships')
        .update({ display_name: fullName, location, city: form.city || null, state: form.city ? 'New York' : null })
        .eq('user_id', editTarget.id);
    }

    setUsers(prev => prev.map(u => u.id === editTarget.id ? {
      ...u,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      full_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
      gender: form.gender || null,
      city: form.city || null,
      state: form.city ? 'New York' : null,
      location,
      phone: form.phone.trim() || null,
      ntrp_rating: form.ntrp_rating ? parseFloat(form.ntrp_rating) : null,
      role: form.role,
    } : u));
    setSaving(false);
    setEditTarget(null);
  };

  const addToLadder = async () => {
    if (!editTarget || !addLadderId) return;
    setAddingLadder(true);
    setAddLadderError('');
    try {
      const { membership } = await callApi('/api/admin-add-to-ladder', {
        target_user_id: editTarget.id,
        ladder_id: addLadderId,
      });
      const ladderName = ladders.find(l => l.id === addLadderId)?.name || 'Unknown Ladder';
      const updatedLadders = [...editTarget.ladders, { ladder_id: addLadderId, ladder_name: ladderName, status: membership.status }];
      setEditTarget(prev => ({ ...prev, ladders: updatedLadders }));
      setUsers(prev => prev.map(u => u.id === editTarget.id ? { ...u, ladders: updatedLadders } : u));
      setAddLadderId('');
    } catch (err) {
      setAddLadderError(err.message || 'Failed to add to ladder');
    } finally {
      setAddingLadder(false);
    }
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
    <div className="w-full">
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
              <div key={u.id} className="flex items-center gap-3 px-6 py-3">
                <PlayerAvatar user={u} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{getDisplayName(u)}</p>
                    {isSelf && <span className="text-xs text-muted-foreground flex-shrink-0">(you)</span>}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'} capitalize`}>
                      {u.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.email} · Joined {u.created_at ? formatDateOnly(u.created_at) : '—'}
                    {u.ladders.length > 0 ? ` · ${u.ladders.map(l => l.ladder_name).join(', ')}` : ' · Not on a ladder'}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(u)} className="h-8 text-xs gap-1">
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
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

      {/* Edit user dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editTarget ? getDisplayName(editTarget) : 'User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">First name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: toSentenceCase(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Last name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: toSentenceCase(e.target.value) }))} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Gender</label>
              <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <CityAutocomplete value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} />

            <div>
              <label className="text-sm font-medium mb-1.5 block">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={form.phone}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    let formatted = digits;
                    if (digits.length >= 7) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                    else if (digits.length >= 4) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                    else if (digits.length >= 1) formatted = `(${digits}`;
                    setForm(f => ({ ...f, phone: formatted }));
                  }}
                />
              </div>
            </div>

            <NtrpRatingSelect value={form.ntrp_rating} onValueChange={v => setForm(f => ({ ...f, ntrp_rating: v }))} required={false} />

            <div>
              <label className="text-sm font-medium mb-1.5 block">Role</label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-3">
              <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
                Ladders
              </label>
              {editTarget?.ladders.length > 0 ? (
                <ul className="space-y-1 mb-3">
                  {editTarget.ladders.map((l, i) => (
                    <li key={i} className="text-sm flex items-center justify-between px-3 py-1.5 bg-muted/40 rounded-lg">
                      <span>{l.ladder_name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{l.status?.replace('_', ' ')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">Not on any ladder yet.</p>
              )}
              {addLadderError && <p className="text-sm text-red-600 mb-2">{addLadderError}</p>}
              <div className="flex gap-2">
                <Select value={addLadderId} onValueChange={setAddLadderId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select a ladder to add" /></SelectTrigger>
                  <SelectContent>
                    {ladders.filter(l => !editTarget?.ladders.some(m => m.ladder_id === l.id)).map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={addToLadder}
                  disabled={!addLadderId || addingLadder}
                  className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] gap-1.5 flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  {addingLadder ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button onClick={saveEdit} disabled={saving} className="bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
