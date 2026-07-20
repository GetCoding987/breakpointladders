import { supabaseAdmin } from './supabaseAdmin.js';
import { sendNotificationEmail } from './resendEmail.js';

// Inserts a notification via the service role (RLS has no client insert
// policy on notifications by design — see supabase/migrations) and fans
// out an email for the types that warrant one.
export async function createNotification({ user_id, type, title, body, related_id }) {
	const { data: notification, error } = await supabaseAdmin
		.from('notifications')
		.insert({ user_id, type, title, body, related_id })
		.select()
		.single();
	if (error) throw error;

	const [{ data: authUser }, { data: profile }] = await Promise.all([
		supabaseAdmin.auth.admin.getUserById(user_id),
		supabaseAdmin.from('profiles').select('full_name').eq('id', user_id).single(),
	]);

	// sendNotificationEmail throws on real failures (missing key, missing
	// recipient email, Resend API error) — intentionally left unguarded so
	// those failures propagate to api/notify.js's try/catch and land in
	// server logs instead of failing silently.
	await sendNotificationEmail({
		toEmail: authUser?.user?.email,
		fullName: profile?.full_name,
		type,
		title,
		body,
	});

	return notification;
}

export async function createNotifications(notifications) {
	return Promise.all(notifications.map((n) => createNotification(n)));
}
