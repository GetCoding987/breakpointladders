import { Resend } from 'resend';

const APP_URL = process.env.APP_BASE_URL || 'https://breakpoint-ladders.vercel.app';
const LOGO_URL = `${APP_URL}/logo.png`;

const EMAILED_TYPES = [
	'challenge_received',
	'challenge_accepted',
	'challenge_declined',
	'score_submitted',
	'score_confirmed',
	'score_disputed',
	'new_message',
	'match_reminder',
	'membership_expiring',
	'membership_expired',
];

const escapeHtml = (str) =>
	String(str || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');

function buildEmailHtml({ fullName, title, body, type }) {
	const firstName = escapeHtml(fullName ? fullName.split(' ')[0] : 'Player');
	const bodyHtml = escapeHtml(body || '').replace(/\n/g, '<br/>');
	const isMembershipNotice = type === 'membership_expiring' || type === 'membership_expired';
	const ctaUrl = isMembershipNotice ? `${APP_URL}/join` : APP_URL;
	const ctaLabel = isMembershipNotice ? 'Renew Membership' : 'View on Break Point';

	return (
		`<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">` +
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: 16px 32px;">` +
		`<tr>` +
		`<td align="left" style="font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #999999;">` +
		`<a href="${APP_URL}/login" style="color: #999999; text-decoration: none;">Sign In</a>` +
		`</td>` +
		`<td align="right" style="font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #999999;">` +
		`<a href="${APP_URL}" style="color: #999999; text-decoration: none;">View in Browser</a>` +
		`</td>` +
		`</tr>` +
		`</table>` +
		`<div style="background: hsl(217, 72%, 16%); padding: 40px 32px; text-align: center;">` +
		`<img src="${LOGO_URL}" alt="Break Point Westchester" style="max-width: 240px; height: auto;" />` +
		`</div>` +
		`<div style="padding: 48px 32px 24px 32px;">` +
		`<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #333333;">Hi ${firstName},</p>` +
		`<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #333333;">${bodyHtml}</p>` +
		`</div>` +
		`<div style="padding: 8px 32px 48px 32px; text-align: center;">` +
		`<a href="${ctaUrl}" style="display: inline-block; background: hsl(142, 50%, 45%); color: #ffffff; font-size: 14px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; text-decoration: none; padding: 16px 48px; border-radius: 999px;">${ctaLabel}</a>` +
		`</div>` +
		`<div style="padding: 24px 32px 40px 32px; text-align: center; border-top: 1px solid #eeeeee;">` +
		`<p style="margin: 0; font-size: 12px; line-height: 1.6; color: #999999;">The Break Point Ladder Team<br/>` +
		`<a href="${APP_URL}" style="color: #999999; text-decoration: none;">${APP_URL.replace('https://', '')}</a></p>` +
		`</div>` +
		`</div>`
	);
}

export async function sendNotificationEmail({ toEmail, fullName, type, title, body }) {
	if (!EMAILED_TYPES.includes(type)) return { skipped: true, reason: 'notification type not emailed' };
	if (!toEmail) throw new Error(`sendNotificationEmail: no email on file for user (type: ${type})`);

	if (!process.env.RESEND_API_KEY) {
		throw new Error('RESEND_API_KEY not configured');
	}

	const resend = new Resend(process.env.RESEND_API_KEY);
	const subject = (title || 'Break Point Ladder Notification').replace(/[\r\n]/g, '');
	const html = buildEmailHtml({ fullName, title, body, type });

	const { data, error } = await resend.emails.send({
		from: process.env.RESEND_FROM_ADDRESS || 'Break Point Ladders <noreply@breakpointladders.com>',
		to: toEmail,
		subject,
		html,
	});

	if (error) {
		console.error('Resend send error:', error);
		throw new Error(`Resend send error: ${error.message}`);
	}
	return { success: true, message_id: data?.id };
}
