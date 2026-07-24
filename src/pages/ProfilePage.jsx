import { useState, useEffect } from 'react';
import { supabase, getCurrentUser } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Camera, Snowflake, Sun, CreditCard, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PlayerAvatar from '@/components/PlayerAvatar';
import FreezeStatusBadge from '@/components/FreezeStatusBadge';
import { formatEasternDateFull, formatDateOnly } from '@/utils/easternTime';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CityAutocomplete from '@/components/CityAutocomplete';
import { getDisplayName } from '@/utils/userHelpers';
import { NtrpDefinitionsLink, NtrpRatingSelect } from '@/components/NtrpRatingField';

export default function ProfilePage() {
  const { checkUserAuth } = useAuth();
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [ladder, setLadder] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showFreeze, setShowFreeze] = useState(false);
  const [freezeReturnDate, setFreezeReturnDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const u = await getCurrentUser();
    setUser(u);
    // Parse first/last name from custom fields, or fall back to full_name
    let firstName = u.first_name || '';
    let lastName = u.last_name || '';
    if ((!firstName || !lastName) && u.full_name) {
      const nameParts = u.full_name.split(' ');
      if (!firstName) firstName = nameParts[0] || '';
      if (!lastName) lastName = nameParts.slice(1).join(' ') || '';
    }
    // Parse city/state from existing fields, or fall back to location string
    let city = u.city || '';
    let state = u.state || '';
    if ((!city || !state) && u.location) {
      const parts = u.location.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        if (!city) city = parts[0];
        if (!state) {
          const s = parts[1];
          state = s === 'NY' ? 'New York' : s === 'CT' ? 'Connecticut' : s;
        }
      }
    }
    setForm({
      first_name: firstName,
      last_name: lastName,
      email: u.email || '',
      city,
      state,
      phone: u.phone || '',
      ntrp_rating: u.ntrp_rating != null ? String(u.ntrp_rating) : '',
    });

    const { data: mems } = await supabase.from('ladder_memberships').select('*').match({ user_id: u.id });
    if (mems?.length > 0) {
      setMembership(mems[0]);
      const { data: ladders } = await supabase.from('ladders').select('*').match({ id: mems[0].ladder_id });
      if (ladders?.length > 0) setLadder(ladders[0]);
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    setFormError('');
    if (!form.first_name.trim()) return setFormError('First name is required.');
    if (!form.last_name.trim()) return setFormError('Last name is required.');
    if (!form.email.trim()) return setFormError('Email is required.');
    if (!form.city.trim()) return setFormError('City is required.');
    if (!form.state.trim()) return setFormError('State is required.');

    setSaving(true);
    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const location = `${form.city.trim()}, ${form.state.trim()}`;
    const ntrpRating = form.ntrp_rating ? parseFloat(form.ntrp_rating) : null;
    await supabase.from('profiles').update({ first_name: firstName, last_name: lastName, location, city: form.city.trim(), state: form.state.trim(), phone: form.phone, ntrp_rating: ntrpRating }).eq('id', user.id);
    if (membership) {
      await supabase.from('ladder_memberships').update({ display_name: fullName, location, city: form.city.trim(), state: form.state.trim() }).eq('id', membership.id);
    }
    // Update local user state immediately and refresh global auth context
    setUser(prev => ({ ...prev, first_name: firstName, last_name: lastName, full_name: fullName, location, city: form.city.trim(), state: form.state.trim(), phone: form.phone, ntrp_rating: ntrpRating }));
    await checkUserAuth();
    setSaving(false);
    setEditing(false);
  };

  const freezeAccount = async () => {
    if (!membership) return;
    await supabase.from('ladder_memberships').update({
      status: 'frozen_voluntary',
      freeze_start_date: new Date().toISOString().split('T')[0],
      freeze_return_date: freezeReturnDate || null,
    }).eq('id', membership.id);
    setShowFreeze(false);
    load();
  };

  const unfreezeAccount = async () => {
    if (!membership) return;
    await supabase.from('ladder_memberships').update({
      status: 'active',
      freeze_start_date: null,
      freeze_return_date: null,
    }).eq('id', membership.id);
    load();
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) { console.error('Avatar upload failed:', uploadError); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    // Keep membership avatar in sync
    if (membership) {
      await supabase.from('ladder_memberships').update({ avatar_url: publicUrl }).eq('id', membership.id);
    }
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>
  );

  const winRate = membership
    ? (membership.wins + membership.losses > 0
      ? Math.round(membership.wins / (membership.wins + membership.losses) * 100)
      : 0)
    : 0;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your account details</p>
        </div>
        <Button
          onClick={() => editing ? saveProfile() : setEditing(true)}
          disabled={saving}
          className={editing ? 'bg-green-600 hover:bg-green-700' : 'bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)]'}
        >
          {editing ? (
            <><Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}</>
          ) : 'Edit Profile'}
        </Button>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
        <div className="h-28 bg-gradient-to-br from-[hsl(217,72%,16%)] to-[hsl(217,50%,28%)]" />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative">
              <PlayerAvatar user={user} size="xl" />
              <label className="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center cursor-pointer border border-border hover:bg-muted transition-colors">
                <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              </label>
            </div>
            <FreezeStatusBadge status={membership?.status} />
          </div>
          <h2 className="text-xl font-bold">{getDisplayName(user) || [form.first_name, form.last_name].filter(Boolean).join(' ') || '—'}</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>

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
        </div>
      </div>

      {/* Profile details */}
      <div className="bg-white rounded-2xl shadow-sm border border-border p-6 mb-6">
        <h3 className="font-bold mb-4">Player Details</h3>
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-red-600 mb-2">{formError}</p>
          )}
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-sm font-medium mb-1.5 block">First name <span className="text-red-500">*</span></label>
                   <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name" />
                 </div>
                 <div>
                   <label className="text-sm font-medium mb-1.5 block">Last name <span className="text-red-500">*</span></label>
                   <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last name" />
                 </div>
               </div>
               <div>
                 <label className="text-sm font-medium mb-1.5 block">Gender</label>
                 <Select value={form.gender} onValueChange={value => setForm(f => ({ ...f, gender: value }))}>
                   <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="Male">Male</SelectItem>
                     <SelectItem value="Female">Female</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email <span className="text-red-500">*</span></label>
                <Input
                  type="email"
                  value={form.email}
                  disabled
                  className="bg-muted/40 text-muted-foreground cursor-not-allowed"
                  placeholder="email@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <CityAutocomplete
                  value={form.city}
                  onChange={(val) => setForm(f => ({ ...f, city: val }))}
                  required
                />
                <div>
                  <label className="text-sm font-medium mb-1.5 block">State <span className="text-red-500">*</span></label>
                  <Select
                    value={form.state}
                    onValueChange={value => setForm(f => ({ ...f, state: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New York">New York</SelectItem>
                      <SelectItem value="Connecticut">Connecticut</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Phone</label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={e => {
                    // Strip non-digits, limit to 10
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    // Format as (XXX) XXX-XXXX
                    let formatted = digits;
                    if (digits.length >= 7) {
                      formatted = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
                    } else if (digits.length >= 4) {
                      formatted = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
                    } else if (digits.length >= 1) {
                      formatted = `(${digits}`;
                    }
                    setForm(f => ({ ...f, phone: formatted }));
                  }}
                  placeholder="(555) 555-5555"
                />
              </div>
              <NtrpRatingSelect
                value={form.ntrp_rating}
                onValueChange={value => setForm(f => ({ ...f, ntrp_rating: value }))}
                required={false}
              />
            </>
          ) : (
            <div className="space-y-3">
               <div className="flex justify-between text-sm"><span className="text-muted-foreground">Name</span><span className="font-medium">{getDisplayName(user)}</span></div>
               <div className="flex justify-between text-sm"><span className="text-muted-foreground">Email</span><span className="font-medium">{user?.email || '—'}</span></div>
               {user?.gender && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Gender</span><span className="font-medium">{user.gender}</span></div>}
               {(user?.city || user?.state || user?.location) && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Location</span><span className="font-medium">{[user.city, user.state].filter(Boolean).join(', ') || user.location}</span></div>}
               {user?.phone && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Phone</span><span className="font-medium">{user.phone}</span></div>}
               {user?.ntrp_rating && (
                 <div className="flex justify-between text-sm">
                   <span className="text-muted-foreground"><NtrpDefinitionsLink>NTRP Self-Rating</NtrpDefinitionsLink></span>
                   <span className="font-medium">{user.ntrp_rating}</span>
                 </div>
               )}
              {!user?.city && !user?.state && !user?.location && !user?.phone && (
                <p className="text-sm text-muted-foreground">Click "Edit Profile" to add your details.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Membership */}
      {membership && (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6 mb-6">
          <h3 className="font-bold mb-4">Membership</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Ladder</span><span className="font-medium">{ladder?.name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Joined</span><span className="font-medium">{membership.joined_date ? formatDateOnly(membership.joined_date) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expires</span>
              <span className={`font-medium ${membership.membership_expires && new Date(membership.membership_expires) < new Date() ? 'text-red-500' : ''}`}>
                {membership.membership_expires ? formatDateOnly(membership.membership_expires) : '—'}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
              <span className={`font-semibold capitalize ${
                membership.status === 'active' ? 'text-green-600' : 'text-amber-600'
              }`}>{membership.status.replace('_', ' ')}</span>
            </div>
          </div>
          {(membership.status === 'frozen_expired') && (
            <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-200">
              <p className="text-sm text-red-700 font-medium">Your membership has expired</p>
              <p className="text-xs text-red-600 mt-1">Renew to continue competing on the ladder.</p>
              <Button size="sm" className="mt-3 bg-red-600 hover:bg-red-700 gap-2">
                <CreditCard className="w-3.5 h-3.5" />
                Renew Membership
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Freeze controls */}
      {membership && membership.status === 'active' && (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
          <h3 className="font-bold mb-2">Freeze My Spot</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Going on vacation or taking a break? Freeze your ladder position so no one can challenge you while you're away.
            Your season membership will continue to run during the freeze.
          </p>
          <Button
            onClick={() => setShowFreeze(true)}
            variant="outline"
            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Snowflake className="w-4 h-4" />
            Freeze My Spot
          </Button>
        </div>
      )}

      {membership && membership.status === 'frozen_voluntary' && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <Snowflake className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-blue-800">Your spot is frozen</h3>
          </div>
          <p className="text-sm text-blue-700 mb-1">
            Frozen since: {membership.freeze_start_date ? formatDateOnly(membership.freeze_start_date) : '—'}
          </p>
          {membership.freeze_return_date && (
            <p className="text-sm text-blue-700 mb-4">
              Expected return: {formatDateOnly(membership.freeze_return_date)}
            </p>
          )}
          <Button onClick={unfreezeAccount} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Sun className="w-4 h-4" />
            Unfreeze & Return to Active
          </Button>
        </div>
      )}

      {/* Freeze Dialog */}
      <Dialog open={showFreeze} onOpenChange={setShowFreeze}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Freeze Your Ladder Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              While frozen, no one can challenge you and your rank stays the same. Your $
              {ladder?.annual_fee || 25}/season membership continues during this time.
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Expected Return Date (optional)</label>
              <Input
                type="date"
                value={freezeReturnDate}
                onChange={e => setFreezeReturnDate(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowFreeze(false)}>Cancel</Button>
              <Button onClick={freezeAccount} className="bg-blue-600 hover:bg-blue-700 gap-2">
                <Snowflake className="w-4 h-4" />
                Freeze My Spot
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}