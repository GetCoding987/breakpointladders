import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not set');
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    if (!signature) {
      console.error('Missing stripe-signature header');
      return Response.json({ error: 'Missing signature' }, { status: 400 });
    }
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata || {};

      // Check if membership already exists (prevent duplicates)
      const existing = await base44.asServiceRole.entities.LadderMembership.filter({
        user_id: metadata.user_id,
        ladder_id: metadata.ladder_id,
      });
      if (existing.length > 0) {
        return Response.json({ received: true, message: 'Membership already exists' });
      }

      // Calculate rank
      const allMems = await base44.asServiceRole.entities.LadderMembership.filter({
        ladder_id: metadata.ladder_id,
      });
      const maxRank = allMems.length > 0 ? Math.max(...allMems.map((m) => m.rank || 0)) : 0;

      // BreakPoint seasons: Spring (Mar 1 - Jun 30), Summer/Fall (Jul 1 - Oct 31)
      // Off-season (Nov-Feb): membership expires at end of next Spring season
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

      await base44.asServiceRole.entities.LadderMembership.create({
        user_id: metadata.user_id,
        ladder_id: metadata.ladder_id,
        display_name: metadata.display_name || 'Unknown',
        avatar_url: metadata.avatar_url || null,
        location: metadata.location || null,
        playing_style: metadata.playing_style || null,
        favorite_surface: metadata.favorite_surface || null,
        rank: maxRank + 1,
        wins: 0,
        losses: 0,
        status: 'active',
        membership_expires: expiryDate.toISOString().split('T')[0],
        joined_date: new Date().toISOString().split('T')[0],
        stripe_payment_id: session.id,
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});