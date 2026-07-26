import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { createNotification } from '../../lib/createNotification.js';

function isAuthorizedCron(req) {
	if (!process.env.CRON_SECRET) return true;
	return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
}

// Spring: Mar 1 – Jun 30. Summer/Fall: Jul 1 – Oct 31.
function isSeasonStartDate(now) {
	const month = now.getMonth() + 1;
	const day = now.getDate();
	return (month === 3 && day === 1) || (month === 7 && day === 1);
}

export default async function handler(req, res) {
	if (!isAuthorizedCron(req)) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	try {
		const now = new Date();
		if (!isSeasonStartDate(now)) {
			return res.status(200).json({ success: true, skipped: 'not a season-start date' });
		}
		const today = now.toISOString().split('T')[0];

		const { data: admins, error: adminsError } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
		if (adminsError) throw adminsError;

		const { data: ladders, error: laddersError } = await supabaseAdmin.from('ladders').select('id, name').eq('status', 'active');
		if (laddersError) throw laddersError;

		let sent = 0;
		let skipped = 0;

		for (const admin of admins || []) {
			for (const ladder of ladders || []) {
				const relatedId = `${today}:${ladder.id}`;
				const { data: existing } = await supabaseAdmin
					.from('notifications')
					.select('id')
					.match({ type: 'season_transition', related_id: relatedId });
				if (existing?.length > 0) {
					skipped++;
					continue;
				}

				await createNotification({
					user_id: admin.id,
					type: 'season_transition',
					title: 'New Season Has Started',
					body: `A new season has started for ${ladder.name}. Head to the Admin panel and click "Reset Season" when you're ready to clear match history and start fresh win-loss records.`,
					related_id: relatedId,
				});
				sent++;
			}
		}

		return res.status(200).json({ success: true, sent, skipped });
	} catch (error) {
		console.error('season-transition-reminder error:', error);
		return res.status(500).json({ error: error.message });
	}
}
