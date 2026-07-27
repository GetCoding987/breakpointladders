import { supabaseAdmin, getUserFromRequest } from '../lib/supabaseAdmin.js';
import { computeInitialRankAndShift } from '../lib/ladderPlacement.js';
import { getSeasonExpiryString } from '../lib/seasonExpiry.js';

// Admin-only: add a player to a ladder directly, bypassing payment/promo and
// NTRP eligibility (an explicit admin override, same spirit as the "Move"
// action on the Admin Players tab). ladder_memberships has no client insert
// policy, so this has to go through a service-role endpoint like every other
// membership-creating path (redeem-promo-code, stripe-webhook).
export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const caller = await getUserFromRequest(req);
		if (!caller) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', caller.id).single();
		if (callerProfile?.role !== 'admin') {
			return res.status(403).json({ error: 'Admin only' });
		}

		const { target_user_id, ladder_id } = req.body || {};
		if (!target_user_id || !ladder_id) {
			return res.status(400).json({ error: 'Missing target_user_id or ladder_id' });
		}

		const { data: existing } = await supabaseAdmin
			.from('ladder_memberships')
			.select('id')
			.match({ user_id: target_user_id, ladder_id });
		if (existing?.length > 0) {
			return res.status(400).json({ error: 'Already a member of this ladder' });
		}

		const { data: profile } = await supabaseAdmin
			.from('profiles')
			.select('first_name, last_name, full_name, avatar_url, location, city, state, ntrp_rating')
			.eq('id', target_user_id)
			.single();

		const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.full_name || '';
		const rank = await computeInitialRankAndShift(supabaseAdmin, ladder_id, profile?.ntrp_rating ?? null);

		const { data: membership, error: insertError } = await supabaseAdmin.from('ladder_memberships').insert({
			user_id: target_user_id,
			ladder_id,
			display_name: displayName,
			avatar_url: profile?.avatar_url || null,
			location: profile?.location || null,
			rank,
			wins: 0,
			losses: 0,
			status: 'active',
			membership_expires: getSeasonExpiryString(),
			joined_date: new Date().toISOString().split('T')[0],
			amount_paid: 0,
			created_by_id: caller.id,
		}).select().single();

		if (insertError) throw insertError;

		return res.status(200).json({ success: true, membership });
	} catch (error) {
		console.error('admin-add-to-ladder error:', error);
		return res.status(500).json({ error: error.message });
	}
}
