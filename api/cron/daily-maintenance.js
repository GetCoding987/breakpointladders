// Consolidated daily cron — Vercel's Hobby plan caps a deployment at 12
// serverless functions, so all scheduled maintenance jobs run from this one
// endpoint instead of one file each. Each section is independent and wrapped
// in its own try/catch so one failing section doesn't block the others.
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { createNotification } from '../../lib/createNotification.js';
import { updateRankingsForForfeit } from '../../lib/adminRankingUpdate.js';

function isAuthorizedCron(req) {
	if (!process.env.CRON_SECRET) return true;
	return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
}

async function sendMatchReminders() {
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

	return { targetDate, challengesFound: challenges?.length || 0, remindersSent, skipped };
}

async function sendMembershipExpiryReminders() {
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

	return { targetDate, membershipsFound: memberships?.length || 0, remindersSent, skipped };
}

const FORFEIT_WINDOW_HOURS = 48;
const FREEZE_AFTER_STREAK = 2;

async function autoForfeitChallenges() {
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

	return { forfeited, frozen };
}

// Spring: Mar 1 – Jun 30. Summer/Fall: Jul 1 – Oct 31.
function isSeasonStartDate(now) {
	const month = now.getMonth() + 1;
	const day = now.getDate();
	return (month === 3 && day === 1) || (month === 7 && day === 1);
}

async function seasonTransitionReminder() {
	const now = new Date();
	if (!isSeasonStartDate(now)) {
		return { skipped: 'not a season-start date' };
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

	return { sent, skipped };
}

const MATCH_WINDOW_DAYS = 14;

async function expireStaleChallenges() {
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
		if (existingMatch) continue;

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

	return { expired };
}

async function autoConfirmScores() {
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

	return { confirmed };
}

export default async function handler(req, res) {
	if (!isAuthorizedCron(req)) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	const results = {};

	const jobs = [
		['matchReminders', sendMatchReminders],
		['membershipExpiryReminders', sendMembershipExpiryReminders],
		['autoForfeitChallenges', autoForfeitChallenges],
		['seasonTransitionReminder', seasonTransitionReminder],
		['expireStaleChallenges', expireStaleChallenges],
		['autoConfirmScores', autoConfirmScores],
	];

	for (const [name, job] of jobs) {
		try {
			results[name] = { success: true, ...(await job()) };
		} catch (error) {
			console.error(`daily-maintenance job "${name}" failed:`, error);
			results[name] = { success: false, error: error.message };
		}
	}

	return res.status(200).json({ success: true, results });
}
