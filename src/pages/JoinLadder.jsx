import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, getCurrentUser, callApi } from '@/lib/supabaseClient';
import { CreditCard, Trophy, CheckCircle, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function JoinLadder() {
  const [user, setUser] = useState(null);
  const [ladders, setLadders] = useState([]);
  const [selectedLadder, setSelectedLadder] = useState(null);
  const [existingMembership, setExistingMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const u = await getCurrentUser();
    setUser(u);

    const { data: allLadders } = await supabase.from('ladders').select('*').match({ status: 'active' });
    setLadders(allLadders || []);
    if (allLadders?.length > 0) setSelectedLadder(allLadders[0]);

    const { data: mems } = await supabase.from('ladder_memberships').select('*').match({ user_id: u.id });
    if (mems?.length > 0) setExistingMembership(mems[0]);

    setLoading(false);
  };

  const handleCheckout = async (promoCodeOverride, discountPercent) => {
    if (!selectedLadder || !user) return;

    if (window.self !== window.top) {
      alert('Checkout works only from a published app. Please open the app in a new tab.');
      return;
    }

    setProcessing(true);
    try {
      const response = await callApi('/api/create-checkout-session', {
        origin: window.location.origin,
        ladder_id: selectedLadder.id,
        user_id: user.id,
        location: user.location || '',
        playing_style: user.playing_style || '',
        favorite_surface: user.favorite_surface || '',
        promo_code: promoCodeOverride || undefined,
      });
      window.location.href = response.url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
      setProcessing(false);
    }
  };

  const handleJoin = () => {
    if (promoCode.trim()) {
      handlePromoRedemption();
    } else {
      handleCheckout();
    }
  };

  const handlePromoRedemption = async () => {
    if (!selectedLadder || !user) return;

    setProcessing(true);
    try {
      const response = await callApi('/api/redeem-promo-code', {
        ladder_id: selectedLadder.id,
        promo_code: promoCode,
      });
      const discount = response.discount_percent;
      if (discount < 100) {
        // Partial discount — proceed to Stripe checkout at reduced price
        await handleCheckout(promoCode, discount);
      } else {
        // 100% discount — membership created, go home
        navigate('/');
      }
    } catch (error) {
      console.error('Promo redemption error:', error);
      alert(error.message || 'Invalid promo code. Please try again.');
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>
  );

  if (existingMembership) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎾</div>
          <h1 className="text-3xl font-bold">Join the Ladder</h1>
          <p className="text-muted-foreground mt-2">Select a ladder and pay the season membership fee to start competing.</p>
        </div>

        {/* Ladder selection */}
        <div className="space-y-3 mb-6">
          {ladders.map(ladder => (
            <button
              key={ladder.id}
              onClick={() => setSelectedLadder(ladder)}
              className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                selectedLadder?.id === ladder.id
                  ? 'border-[hsl(217,72%,40%)] bg-blue-50'
                  : 'border-border bg-white hover:border-[hsl(217,72%,40%)]/50'
              }`}
            >
              <Trophy className={`w-8 h-8 ${selectedLadder?.id === ladder.id ? 'text-[hsl(217,72%,40%)]' : 'text-muted-foreground'}`} />
              <div className="flex-1">
                <p className="font-bold">{ladder.name}</p>
                {ladder.description && <p className="text-sm text-muted-foreground">{ladder.description}</p>}
                <p className="text-sm font-semibold text-green-600 mt-1">${ladder.annual_fee}/season</p>
              </div>
              {selectedLadder?.id === ladder.id && (
                <CheckCircle className="w-6 h-6 text-[hsl(217,72%,40%)]" />
              )}
            </button>
          ))}
        </div>

        {selectedLadder && (
          <div className="bg-white rounded-2xl border border-border p-6 mb-6 shadow-sm">
            <h3 className="font-bold mb-4">Order Summary</h3>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Season membership — {selectedLadder.name}</span>
              <span className="font-semibold">${selectedLadder.annual_fee}.00</span>
            </div>
            <div className="border-t border-border pt-3 mt-3 flex justify-between">
              <span className="font-bold">Total</span>
              <span className="font-bold text-lg">${selectedLadder.annual_fee}.00/season</span>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 mb-6 text-center">
          {[
            { icon: Zap, label: 'Open Challenges' },
            { icon: Trophy, label: 'Live Rankings' },
            { icon: Shield, label: 'Secure Payment' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="bg-white rounded-xl border border-border p-4">
              <Icon className="w-5 h-5 mx-auto mb-2 text-[hsl(217,72%,40%)]" />
              <p className="text-xs font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Rules agreement */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <input
            type="checkbox"
            id="rules-agree"
            checked={agreedToRules}
            onChange={e => setAgreedToRules(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-[hsl(217,72%,40%)] cursor-pointer flex-shrink-0"
          />
          <label htmlFor="rules-agree" className="text-sm cursor-pointer">
            I have read and agree to the{' '}
            <Link to="/rules" target="_blank" className="font-semibold text-[hsl(217,72%,40%)] underline underline-offset-2 hover:opacity-80">
              BreakPoint Ladders Official Rules
            </Link>
            . I understand that violations may result in suspension or removal from the ladder.
          </label>
        </div>

        {/* Promo code */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Promo code (optional)"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(217,72%,40%)]"
          />
          {promoCode.trim() && (
            <p className="text-xs text-green-600 mt-1">✓ Promo code will be applied at checkout</p>
          )}
        </div>

        <Button
          onClick={handleJoin}
          disabled={!selectedLadder || !agreedToRules || processing}
          className="w-full bg-[hsl(217,72%,16%)] hover:bg-[hsl(217,72%,22%)] h-12 text-base gap-2"
        >
          <CreditCard className="w-5 h-5" />
          {processing
            ? 'Processing...'
            : `Pay $${selectedLadder?.annual_fee || 25} & Join Ladder`}
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-3">
          Stripe payment integration — secure and encrypted. Season renewal required.
        </p>
      </div>
    </div>
  );
}