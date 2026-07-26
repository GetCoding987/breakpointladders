import { supabaseAdmin, getUserFromRequest } from '../lib/supabaseAdmin.js';
import { deleteUserCompletely } from '../lib/deleteUserData.js';

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const user = await getUserFromRequest(req);
		if (!user) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		await deleteUserCompletely(supabaseAdmin, user.id);

		return res.status(200).json({ success: true });
	} catch (error) {
		console.error('delete-account error:', error);
		return res.status(500).json({ error: error.message });
	}
}
