import Stripe from 'stripe';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getSeasonExpiryString } from '../lib/seasonExpiry.js';

// Signature verification requires the exact raw request bytes, so
// automatic body parsing must be disabled for this route.
export const config = {
	api: { bodyParser: false },
};

async function buffer(readable) {
	const chunks = [];
	for await (const chunk of readable) {
		chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
	}
	return Buffer.concat(chunks);
}

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
		const rawBody = await buffer(req);
		const signature = req.headers['stripe-signature'];
		const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

		if (!webhookSecret) {
			console.error('STRIPE_WEBHOOK_SECRET is not set');
			return res.status(500).json({ error: 'Webhook secret not configured' });
		}
		if (!signature) {
			return res.status(400).json({ error: 'Missing signature' });
		}

		const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

		if (event.type === 'checkout.session.completed') {
			const session = event.data.object;
			const metadata = session.metadata || {};

			const { data: existing } = await supabaseAdmin
				.from('ladder_memberships')
				.select('id')
				.match({ user_id: metadata.user_id, ladder_id: metadata.ladder_id });
			if (existing?.length > 0) {
				return res.status(200).json({ received: true, message: 'Membership already exists' });
			}

			const { data: allMems } = await supabaseAdmin
				.from('ladder_memberships')
				.select('rank')
				.eq('ladder_id', metadata.ladder_id);
			const maxRank = allMems?.length > 0 ? Math.max(...allMems.map((m) => m.rank || 0)) : 0;

			await supabaseAdmin.from('ladder_memberships').insert({
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
				membership_expires: getSeasonExpiryString(),
				joined_date: new Date().toISOString().split('T')[0],
				stripe_payment_id: session.id,
			});
		}

		return res.status(200).json({ received: true });
	} catch (error) {
		console.error('stripe-webhook error:', error);
		return res.status(500).json({ error: error.message });
	}
}
