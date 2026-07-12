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
		const threeDaysFromNow = new Date(now);
		threeDaysFromNow.setDate(now.getDate() + 3);
		const targetDate = threeDaysFromNow.toISOString().split('T')[0];

		const { data: memberships, error } = await supabaseAdmin
			.from('ladder_memberships')
			.select('*')
			.match({ membership_expires: targetDate, status: 'active' });
		if (error) throw error;

		let remindersSent = 0;
		let skipped = 0;

		for (const membership of memberships || []) {
			const { data: existing } = await supabaseAdmin
				.from('notifications')
				.select('id')
				.match({ type: 'membership_expiring', related_id: membership.id });
			if (existing?.length > 0) {
				skipped++;
				continue;
			}

			const expiryFormatted = new Date(membership.membership_expires).toLocaleDateString('en-US', {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			});

			await createNotification({
				user_id: membership.user_id,
				type: 'membership_expiring',
				title: 'Your Season Membership Expires in 3 Days',
				body:
					`Your Break Point ladder membership expires on ${expiryFormatted}. ` +
					`Renew now to keep your spot in the ladder and avoid being frozen out.\n\n` +
					`Click the button below to renew your season membership.`,
				related_id: membership.id,
			});
			remindersSent++;
		}

		return res.status(200).json({
			success: true,
			targetDate,
			membershipsFound: memberships?.length || 0,
			remindersSent,
			skipped,
		});
	} catch (error) {
		console.error('send-membership-expiry-reminders error:', error);
		return res.status(500).json({ error: error.message });
	}
}
