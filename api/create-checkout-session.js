import Stripe from 'stripe';
import { supabaseAdmin, getUserFromRequest } from '../lib/supabaseAdmin.js';
import { findPromoCode } from '../lib/stripePromo.js';

const DEFAULT_ORIGIN = process.env.APP_BASE_URL || 'https://breakpoint-ladders.vercel.app';

function isAllowedOrigin(origin) {
	if (!origin) return false;
	const allowed = (process.env.ALLOWED_CHECKOUT_ORIGINS || DEFAULT_ORIGIN)
		.split(',')
		.map((o) => o.trim());
	try {
		const url = new URL(origin);
		return allowed.some((a) => {
			try {
				return new URL(a).hostname === url.hostname;
			} catch {
				return false;
			}
		});
	} catch {
		return false;
	}
}

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const { origin, ladder_id, user_id, promo_code, location, playing_style, favorite_surface } = req.body || {};
		if (!ladder_id || !user_id) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const user = await getUserFromRequest(req);
		if (!user) {
			return res.status(401).json({ error: 'Unauthorized' });
		}
		if (user.id !== user_id) {
			return res.status(403).json({ error: 'Cannot create checkout for another user' });
		}

		const baseOrigin = isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN;

		const { data: ladder, error: ladderError } = await supabaseAdmin
			.from('ladders')
			.select('*')
			.eq('id', ladder_id)
			.single();
		if (ladderError || !ladder) {
			return res.status(404).json({ error: 'Ladder not found' });
		}

		let discount_percent = 0;
		if (promo_code) {
			const match = findPromoCode(promo_code);
			if (match && match.discount_percent < 100) {
				discount_percent = match.discount_percent;
			}
		}
		const unit_amount = Math.round(ladder.annual_fee * 100 * (1 - discount_percent / 100));

		const { data: profile } = await supabaseAdmin
			.from('profiles')
			.select('full_name, avatar_url')
			.eq('id', user.id)
			.single();

		const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: [
				{
					price_data: {
						currency: 'usd',
						product_data: {
							name: 'Ladder Membership — ' + ladder.name,
							description: 'Season tennis ladder membership fee',
						},
						unit_amount,
					},
					quantity: 1,
				},
			],
			mode: 'payment',
			success_url: baseOrigin + '/payment-success?session_id={CHECKOUT_SESSION_ID}',
			cancel_url: baseOrigin + '/join',
			metadata: {
				user_id: user.id,
				ladder_id,
				display_name: profile?.full_name || '',
				avatar_url: profile?.avatar_url || '',
				location: location || '',
				playing_style: playing_style || '',
				favorite_surface: favorite_surface || '',
			},
		});

		return res.status(200).json({ url: session.url });
	} catch (error) {
		console.error('create-checkout-session error:', error);
		return res.status(500).json({ error: error.message });
	}
}
