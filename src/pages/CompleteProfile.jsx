import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getCurrentUser } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, MapPin, Phone, Loader2, UserPlus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CityAutocomplete from '@/components/CityAutocomplete';
import AuthLayout from '@/components/AuthLayout';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  const [user, setUser] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const u = await getCurrentUser();
      setUser(u);
      let fn = u.first_name || '';
      let ln = u.last_name || '';
      if ((!fn || !ln) && u.full_name) {
        const parts = u.full_name.split(' ');
        if (!fn) fn = parts[0] || '';
        if (!ln) ln = parts.slice(1).join(' ') || '';
      }
      setFirstName(fn);
      setLastName(ln);
      setGender(u.gender || '');
      setCity(u.city || '');
      setState(u.state || '');
      setPhone(u.phone || '');
      setLoading(false);
    };
    init();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) { setError('Please enter your first and last name'); return; }
    if (!gender) { setError('Please select your gender'); return; }
    if (!state) { setError('Please select your state'); return; }
    if (!city.trim()) { setError('Please select a valid Westchester municipality'); return; }

    setSaving(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      const location = `${city.trim()}, ${state.trim()}`;
      await supabase.from('profiles').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        gender,
        location,
        city: city.trim(),
        state: state.trim(),
        phone: phone.trim(),
      }).eq('id', user.id);
      // Sync membership if exists
      const { data: mems } = await supabase.from('ladder_memberships').select('*').match({ user_id: user.id });
      if (mems?.length > 0) {
        await supabase.from('ladder_memberships').update({
          display_name: fullName,
          location,
          city: city.trim(),
          state: state.trim(),
        }).eq('id', mems[0].id);
      }
      await checkUserAuth();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <AuthLayout
      icon={UserPlus}
      title="Complete your profile"
      subtitle="Please fill in your details to continue"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name <span className="text-red-500">*</span></Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name <span className="text-red-500">*</span></Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gender <span className="text-red-500">*</span></Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger id="gender" className="h-12" required>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CityAutocomplete value={city} onChange={setCity} required />
          <div className="space-y-2">
            <Label htmlFor="state">State <span className="text-red-500">*</span></Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger id="state" className="h-12" required>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="New York">New York</SelectItem>
                <SelectItem value="Connecticut">Connecticut</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 555-5555"
              value={phone}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                let formatted = digits;
                if (digits.length >= 7) formatted = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
                else if (digits.length >= 4) formatted = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
                else if (digits.length >= 1) formatted = `(${digits}`;
                setPhone(formatted);
              }}
              className="pl-10 h-12"
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Continue'}
        </Button>
      </form>
    </AuthLayout>
  );
}