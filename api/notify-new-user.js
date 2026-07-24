import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { sendNewUserAlert } from '../lib/resendEmail.js';

function isAuthorized(req) {
	if (!process.env.NEW_USER_WEBHOOK_SECRET) return false;
	return req.headers.authorization === `Bearer ${process.env.NEW_USER_WEBHOOK_SECRET}`;
}

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	if (!isAuthorized(req)) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	const { user_id } = req.body || {};
	if (!user_id) {
		return res.status(400).json({ error: 'user_id is required' });
	}

	try {
		const [{ data: profile }, { data: authUser }] = await Promise.all([
			supabaseAdmin.from('profiles').select('full_name').eq('id', user_id).single(),
			supabaseAdmin.auth.admin.getUserById(user_id),
		]);

		await sendNewUserAlert({
			fullName: profile?.full_name,
			email: authUser?.user?.email,
		});

		return res.status(200).json({ success: true });
	} catch (err) {
		console.error('notify-new-user error:', err);
		return res.status(500).json({ error: err.message });
	}
}
