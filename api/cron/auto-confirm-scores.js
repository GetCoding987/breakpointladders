import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { createNotification } from '../../lib/createNotification.js';
import { updateRankingsForForfeit } from '../../lib/adminRankingUpdate.js';

function isAuthorizedCron(req) {
	if (!process.env.CRON_SECRET) return true;
	return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
}

export default async function handler(req, res) {
	if (!isAuthorizedCron(req)) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	try {
		const now = new Date().toISOString();

		const { data: pending, error } = await supabaseAdmin
			.from('matches')
			.select('*')
			.match({ status: 'pending_confirmation' })
			.lt('confirmation_deadline', now)
			.not('confirmation_deadline', 'is', null);
		if (error) throw error;

		let confirmed = 0;

		for (const match of pending || []) {
			await supabaseAdmin.from('matches').update({
				status: 'confirmed',
				confirmed_by_id: match.submitted_by_id,
				ranking_updated: true,
			}).eq('id', match.id);

			const loserId = match.winner_id === match.player1_id ? match.player2_id : match.player1_id;
			await updateRankingsForForfeit(supabaseAdmin, {
				ladderId: match.ladder_id,
				winnerId: match.winner_id,
				loserId,
			});

			for (const userId of [match.player1_id, match.player2_id]) {
				try {
					await createNotification({
						user_id: userId,
						type: 'score_confirmed',
						title: 'Score Automatically Confirmed',
						body: `The submitted score (${match.score}) was not disputed within 48 hours, so it has been automatically confirmed and rankings updated.`,
						related_id: match.id,
					});
				} catch (err) {
					console.warn(`Failed to notify ${userId} for auto-confirmed match ${match.id}:`, err?.message);
				}
			}

			confirmed++;
		}

		return res.status(200).json({ success: true, confirmed });
	} catch (error) {
		console.error('auto-confirm-scores error:', error);
		return res.status(500).json({ error: error.message });
	}
}
