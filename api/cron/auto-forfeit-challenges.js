import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { createNotification } from '../../lib/createNotification.js';
import { updateRankingsForForfeit } from '../../lib/adminRankingUpdate.js';

function isAuthorizedCron(req) {
	if (!process.env.CRON_SECRET) return true;
	return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
}

const FORFEIT_WINDOW_HOURS = 48;
const FREEZE_AFTER_STREAK = 2;

export default async function handler(req, res) {
	if (!isAuthorizedCron(req)) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	try {
		const cutoff = new Date(Date.now() - FORFEIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

		const { data: challenges, error } = await supabaseAdmin
			.from('challenges')
			.select('*')
			.match({ status: 'pending' })
			.lte('created_date', cutoff);
		if (error) throw error;

		let forfeited = 0;
		let frozen = 0;

		for (const challenge of challenges || []) {
			const { data: mems } = await supabaseAdmin
				.from('ladder_memberships')
				.select('*')
				.match({ ladder_id: challenge.ladder_id });
			const challengerMem = (mems || []).find(m => m.user_id === challenge.challenger_id);
			const opponentMem = (mems || []).find(m => m.user_id === challenge.opponent_id);
			if (!challengerMem || !opponentMem) continue;

			const [{ data: challengerProfile }, { data: opponentProfile }] = await Promise.all([
				supabaseAdmin.from('profiles').select('full_name').eq('id', challenge.challenger_id).single(),
				supabaseAdmin.from('profiles').select('full_name').eq('id', challenge.opponent_id).single(),
			]);
			const challengerName = challengerProfile?.full_name || 'Your opponent';
			const opponentName = opponentProfile?.full_name || 'Your opponent';

			const newStreak = (opponentMem.no_response_streak || 0) + 1;
			const willFreeze = newStreak >= FREEZE_AFTER_STREAK && opponentMem.status === 'active';

			await supabaseAdmin.from('challenges').update({
				status: 'expired',
				message: (challenge.message ? challenge.message + '\n\n' : '') + 'Automatically expired: no response within 48 hours.',
			}).eq('id', challenge.id);

			await supabaseAdmin.from('matches').insert({
				challenge_id: challenge.id,
				ladder_id: challenge.ladder_id,
				player1_id: challenge.challenger_id,
				player2_id: challenge.opponent_id,
				winner_id: challenge.challenger_id,
				score: 'W/O (No Response)',
				played_date: new Date().toISOString().split('T')[0],
				submitted_by_id: challenge.challenger_id,
				status: 'confirmed',
				ranking_updated: true,
				admin_notes: 'Automatic forfeit — opponent did not respond within 48 hours.',
			});

			const extraLoserFields = { no_response_streak: newStreak };
			if (willFreeze) {
				extraLoserFields.status = 'frozen_no_response';
				extraLoserFields.freeze_start_date = new Date().toISOString().split('T')[0];
			}

			await updateRankingsForForfeit(supabaseAdmin, {
				ladderId: challenge.ladder_id,
				winnerId: challenge.challenger_id,
				loserId: challenge.opponent_id,
				extraLoserFields,
			});

			try {
				await createNotification({
					user_id: challenge.challenger_id,
					type: 'challenge_forfeit_won',
					title: 'Opponent Forfeited — You Win',
					body: `${opponentName} did not respond to your challenge within 48 hours, so it counts as a win by forfeit. Your ranking has been updated. You can now challenge someone else.`,
					related_id: challenge.id,
				});
			} catch (err) {
				console.warn(`Failed to notify challenger for challenge ${challenge.id}:`, err?.message);
			}

			const opponentBody = willFreeze
				? `You didn't respond to ${challengerName}'s challenge within 48 hours. This is the second time in a row this has happened, so your account has been automatically frozen and you can't be challenged while frozen. This also counts as a loss by forfeit and your ranking has been updated.\n\nTo unfreeze and return to active play, go to your Profile page and click "Unfreeze & Return to Active."`
				: `You didn't respond to ${challengerName}'s challenge within 48 hours, so it counts as a loss by forfeit and your ranking has been updated. You can still challenge someone else.\n\nIf you're going to be unavailable for a while, you can freeze your ladder spot from your Profile page so you won't be challenged while you're away.`;

			try {
				await createNotification({
					user_id: challenge.opponent_id,
					type: 'challenge_forfeit_lost',
					title: willFreeze ? 'Forfeit — Your Account Has Been Frozen' : 'Forfeit — You Missed a Challenge Deadline',
					body: opponentBody,
					related_id: challenge.id,
				});
			} catch (err) {
				console.warn(`Failed to notify opponent for challenge ${challenge.id}:`, err?.message);
			}

			forfeited++;
			if (willFreeze) frozen++;
		}

		return res.status(200).json({ success: true, forfeited, frozen });
	} catch (error) {
		console.error('auto-forfeit-challenges error:', error);
		return res.status(500).json({ error: error.message });
	}
}
