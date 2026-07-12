import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { createNotification } from '../../lib/createNotification.js';

function isAuthorizedCron(req) {
	if (!process.env.CRON_SECRET) return true;
	return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
}

export default async function handler(req, res) {
	if (!isAuthorizedCron(req)) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	try {
		const now = new Date();
		const twoDaysFromNow = new Date(now);
		twoDaysFromNow.setDate(now.getDate() + 2);
		const targetDate = twoDaysFromNow.toISOString().split('T')[0];

		const { data: challenges, error } = await supabaseAdmin
			.from('challenges')
			.select('*')
			.match({ status: 'accepted', proposal_status: 'accepted', proposed_date: targetDate });
		if (error) throw error;

		let remindersSent = 0;
		let skipped = 0;

		for (const challenge of challenges || []) {
			const { data: existing } = await supabaseAdmin
				.from('notifications')
				.select('id')
				.match({ type: 'match_reminder', related_id: challenge.id });
			if (existing?.length > 0) {
				skipped++;
				continue;
			}

			const [{ data: p1 }, { data: p2 }] = await Promise.all([
				supabaseAdmin.from('profiles').select('full_name').eq('id', challenge.challenger_id).single(),
				supabaseAdmin.from('profiles').select('full_name').eq('id', challenge.opponent_id).single(),
			]);
			const p1Name = p1?.full_name || 'Your opponent';
			const p2Name = p2?.full_name || 'Your opponent';

			const matchInfo =
				`Date: ${challenge.proposed_date}` +
				(challenge.proposed_time ? `\nTime: ${challenge.proposed_time}` : '') +
				(challenge.proposed_location ? `\nLocation: ${challenge.proposed_location}` : '');

			await createNotification({
				user_id: challenge.challenger_id,
				type: 'match_reminder',
				title: 'Match Reminder — 48 Hours Until Your Match',
				body: `Your match against ${p2Name} is in 48 hours.\n\n${matchInfo}\n\nGood luck!`,
				related_id: challenge.id,
			});
			await createNotification({
				user_id: challenge.opponent_id,
				type: 'match_reminder',
				title: 'Match Reminder — 48 Hours Until Your Match',
				body: `Your match against ${p1Name} is in 48 hours.\n\n${matchInfo}\n\nGood luck!`,
				related_id: challenge.id,
			});
			remindersSent += 2;
		}

		return res.status(200).json({
			success: true,
			targetDate,
			challengesFound: challenges?.length || 0,
			remindersSent,
			skipped,
		});
	} catch (error) {
		console.error('send-match-reminders error:', error);
		return res.status(500).json({ error: error.message });
	}
}
