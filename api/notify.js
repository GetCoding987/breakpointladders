import { getUserFromRequest } from '../lib/supabaseAdmin.js';
import { createNotification, createNotifications } from '../lib/createNotification.js';

// Any authenticated user may call this — regular players legitimately
// trigger notifications for other players today (challenge sent, score
// submitted, message sent, etc). See supabase/migrations for why
// notifications has no client insert policy.
export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const caller = await getUserFromRequest(req);
	if (!caller) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	try {
		if (Array.isArray(req.body?.notifications)) {
			const created = await createNotifications(req.body.notifications);
			return res.status(200).json({ success: true, notifications: created });
		}

		const { user_id, type, title, body, related_id } = req.body || {};
		if (!user_id || !type || !title || !body) {
			return res.status(400).json({ error: 'Missing required fields' });
		}
		const notification = await createNotification({ user_id, type, title, body, related_id });
		return res.status(200).json({ success: true, notification });
	} catch (error) {
		console.error('notify error:', error);
		return res.status(500).json({ error: error.message });
	}
}
