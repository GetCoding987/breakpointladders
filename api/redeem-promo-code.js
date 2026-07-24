import { supabaseAdmin, getUserFromRequest } from '../lib/supabaseAdmin.js';
import { findPromoCode } from '../lib/stripePromo.js';
import { getSeasonExpiryString } from '../lib/seasonExpiry.js';
import { computeInitialRankAndShift } from '../lib/ladderPlacement.js';

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const user = await getUserFromRequest(req);
		if (!user) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const { ladder_id, promo_code } = req.body || {};
		if (!ladder_id || !promo_code) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const match = findPromoCode(promo_code);
		if (!match) {
			return res.status(400).json({ error: 'Invalid promo code' });
		}

		if (match.discount_percent < 100) {
			return res.status(200).json({ success: true, discount_percent: match.discount_percent });
		}

		const { data: existing } = await supabaseAdmin
			.from('ladder_memberships')
			.select('id')
			.match({ user_id: user.id, ladder_id });
		if (existing?.length > 0) {
			return res.status(400).json({ error: 'Already a member of this ladder' });
		}

		const { data: profile } = await supabaseAdmin
			.from('profiles')
			.select('full_name, avatar_url, ntrp_rating')
			.eq('id', user.id)
			.single();

		const rank = await computeInitialRankAndShift(supabaseAdmin, ladder_id, profile?.ntrp_rating ?? null);

		await supabaseAdmin.from('ladder_memberships').insert({
			user_id: user.id,
			ladder_id,
			display_name: profile?.full_name || '',
			avatar_url: profile?.avatar_url || null,
			rank,
			wins: 0,
			losses: 0,
			status: 'active',
			membership_expires: getSeasonExpiryString(),
			joined_date: new Date().toISOString().split('T')[0],
			amount_paid: 0,
		});

		return res.status(200).json({ success: true, discount_percent: 100 });
	} catch (error) {
		console.error('redeem-promo-code error:', error);
		return res.status(500).json({ error: error.message });
	}
}
