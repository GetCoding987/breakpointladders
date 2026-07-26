import { supabaseAdmin, getUserFromRequest } from '../lib/supabaseAdmin.js';
import { deleteUserCompletely } from '../lib/deleteUserData.js';

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const caller = await getUserFromRequest(req);
		if (!caller) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', caller.id).single();
		if (callerProfile?.role !== 'admin') {
			return res.status(403).json({ error: 'Admin only' });
		}

		const { target_user_id } = req.body || {};
		if (!target_user_id) {
			return res.status(400).json({ error: 'Missing target_user_id' });
		}
		if (target_user_id === caller.id) {
			return res.status(400).json({ error: 'Use the Delete My Account option on your own Profile page instead' });
		}

		await deleteUserCompletely(supabaseAdmin, target_user_id);

		return res.status(200).json({ success: true });
	} catch (error) {
		console.error('admin-delete-user error:', error);
		return res.status(500).json({ error: error.message });
	}
}
