import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Validates a promo code server-side and creates a LadderMembership via service role.
// This prevents client-side bypass of payment / promo code verification.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { ladder_id, promo_code } = body;

    if (!ladder_id || !promo_code) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate promo code from environment variable
    // Format: "CODE:PERCENT" or "CODE" (defaults to 100% off)
    const CODES = (Deno.env.get('PROMO_CODES') || '')
      .split(',')
      .map(entry => {
        const [code, pct] = entry.split(':').map(s => s.trim());
        return { code: code.toUpperCase(), discount_percent: pct ? parseInt(pct, 10) : 100 };
      })
      .filter(c => c.code);
    const match = CODES.find(c => c.code === promo_code.trim().toUpperCase());
    if (!match) {
      return Response.json({ error: 'Invalid promo code' }, { status: 400 });
    }

    // Partial discount: return discount info — frontend proceeds to Stripe checkout
    if (match.discount_percent < 100) {
      return Response.json({ success: true, discount_percent: match.discount_percent });
    }

    // Check for existing membership
    const existing = await base44.asServiceRole.entities.LadderMembership.filter({
      user_id: user.id,
      ladder_id,
    });
    if (existing.length > 0) {
      return Response.json({ error: 'Already a member of this ladder' }, { status: 400 });
    }

    // Get current max rank
    const allMems = await base44.asServiceRole.entities.LadderMembership.filter({ ladder_id });
    const maxRank = allMems.length > 0 ? Math.max(...allMems.map(m => m.rank || 0)) : 0;

    // Calculate season expiry (inlined from src/utils/seasons.js — can't import in Deno)
    const now = new Date();
    const month = now.getMonth();
    let expiryDate;
    if (month >= 2 && month <= 5) {
      expiryDate = new Date(now.getFullYear(), 5, 30);
    } else if (month >= 6 && month <= 9) {
      expiryDate = new Date(now.getFullYear(), 9, 31);
    } else if (month >= 10) {
      expiryDate = new Date(now.getFullYear() + 1, 5, 30);
    } else {
      expiryDate = new Date(now.getFullYear(), 5, 30);
    }
    const expiryString = expiryDate.toISOString().split('T')[0];

    await base44.asServiceRole.entities.LadderMembership.create({
      user_id: user.id,
      ladder_id,
      display_name: user.full_name || '',
      avatar_url: user.avatar_url || null,
      rank: maxRank + 1,
      wins: 0,
      losses: 0,
      status: 'active',
      membership_expires: expiryString,
      joined_date: new Date().toISOString().split('T')[0],
    });

    return Response.json({ success: true, discount_percent: 100 });
  } catch (error) {
    console.error('redeemPromoCode error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});