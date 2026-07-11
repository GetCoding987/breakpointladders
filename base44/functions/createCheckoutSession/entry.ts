import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      origin,
      ladder_id,
      user_id,
    } = body;

    if (!ladder_id || !user_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Authenticate the caller and ensure they can only create checkout for themselves
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.id !== user_id) {
      return Response.json({ error: 'Cannot create checkout for another user' }, { status: 403 });
    }

    // Validate origin against a whitelist to prevent open redirect
    const DEFAULT_ORIGIN = 'https://breakpointladders.base44.app';
    const isAllowedOrigin = (o) => {
      if (!o || typeof o !== 'string') return false;
      try {
        const url = new URL(o);
        return url.hostname === 'breakpointladders.base44.app';
      } catch {
        return false;
      }
    };
    const baseOrigin = isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN;

    // Fetch ladder from DB to get authoritative price and name
    const ladder = await base44.asServiceRole.entities.Ladder.get(ladder_id);
    if (!ladder) {
      return Response.json({ error: 'Ladder not found' }, { status: 404 });
    }
    const annual_fee = ladder.annual_fee;
    const ladder_name = ladder.name;

    // Validate promo code server-side and apply discount
    let discount_percent = 0;
    if (body.promo_code) {
      const CODES = (Deno.env.get('PROMO_CODES') || '')
        .split(',')
        .map(entry => {
          const [code, pct] = entry.split(':').map(s => s.trim());
          return { code: code.toUpperCase(), discount_percent: pct ? parseInt(pct, 10) : 100 };
        })
        .filter(c => c.code);
      const match = CODES.find(c => c.code === body.promo_code.trim().toUpperCase());
      if (match && match.discount_percent < 100) {
        discount_percent = match.discount_percent;
      }
    }
    const unit_amount = Math.round(annual_fee * 100 * (1 - discount_percent / 100));

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Ladder Membership — ' + ladder_name,
              description: 'Season tennis ladder membership fee',
            },
            unit_amount: unit_amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: baseOrigin + '/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: baseOrigin + '/join',
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
        user_id: user.id,
        ladder_id,
        display_name: user.full_name || '',
        avatar_url: user.avatar_url || '',
        location: '',
        playing_style: '',
        favorite_surface: '',
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});