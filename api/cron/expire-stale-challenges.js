import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { createNotification } from '../../lib/createNotification.js';

function isAuthorizedCron(req) {
	if (!process.env.CRON_SECRET) return true;
	return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
}

const MATCH_WINDOW_DAYS = 14;

export default async function handler(req, res) {
	if (!isAuthorizedCron(req)) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	try {
		const cutoff = new Date(Date.now() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

		const { data: accepted, error } = await supabaseAdmin
			.from('challenges')
			.select('*')
			.match({ status: 'accepted' })
			.lte('accepted_date', cutoff);
		if (error) throw error;

		let expired = 0;

		for (const challenge of accepted || []) {
			const { data: existingMatch } = await supabaseAdmin
				.from('matches')
				.select('id')
				.eq('challenge_id', challenge.id)
				.maybeSingle();
			if (existingMatch) continue; // match already played/submitted — not stale

			await supabaseAdmin.from('challenges').update({
				status: 'expired',
				message: (challenge.message ? challenge.message + '\n\n' : '') + 'Automatically expired: match not completed within 14 days of acceptance.',
			}).eq('id', challenge.id);

			for (const userId of [challenge.challenger_id, challenge.opponent_id]) {
				try {
					await createNotification({
						user_id: userId,
						type: 'challenge_expired',
						title: 'Challenge Expired',
						body: 'Your accepted challenge was not completed within 14 days, so it has expired with no penalty or ranking change. You can challenge someone else.',
						related_id: challenge.id,
					});
				} catch (err) {
					console.warn(`Failed to notify ${userId} for expired challenge ${challenge.id}:`, err?.message);
				}
			}

			expired++;
		}

		return res.status(200).json({ success: true, expired });
	} catch (error) {
		console.error('expire-stale-challenges error:', error);
		return res.status(500).json({ error: error.message });
	}
}
