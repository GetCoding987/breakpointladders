import { supabaseAdmin, getUserFromRequest } from '../lib/supabaseAdmin.js';

// Most auth.users FKs across the schema have no cascade/set-null (challenges,
// matches, messages, group conversations, and a handful of created_by_id
// columns), so deleting the auth.users row directly would fail with FK
// violations for almost any real user. Everything referencing this user must
// be cleared first; only profiles/ladder_memberships/notifications (by
// user_id) cascade automatically once the auth.users row is gone.
export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const user = await getUserFromRequest(req);
		if (!user) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const userId = user.id;

		await supabaseAdmin.from('conversation_messages').delete().eq('sender_id', userId);
		await supabaseAdmin.from('conversation_participants').delete().eq('user_id', userId);
		await supabaseAdmin.from('conversations').delete().eq('created_by', userId);

		await supabaseAdmin.from('matches').delete().or(
			`player1_id.eq.${userId},player2_id.eq.${userId},winner_id.eq.${userId},submitted_by_id.eq.${userId},confirmed_by_id.eq.${userId},proposed_winner_id.eq.${userId},proposed_by_id.eq.${userId},created_by_id.eq.${userId}`
		);
		await supabaseAdmin.from('challenges').delete().or(
			`challenger_id.eq.${userId},opponent_id.eq.${userId},proposed_by_id.eq.${userId},created_by_id.eq.${userId}`
		);
		await supabaseAdmin.from('messages').delete().or(
			`sender_id.eq.${userId},recipient_id.eq.${userId},created_by_id.eq.${userId}`
		);

		// These created_by_id columns are nullable and unrelated to the user's
		// own data — null them out instead of deleting the underlying rows.
		await supabaseAdmin.from('notifications').update({ created_by_id: null }).eq('created_by_id', userId);
		await supabaseAdmin.from('announcements').update({ created_by_id: null }).eq('created_by_id', userId);
		await supabaseAdmin.from('ladders').update({ created_by_id: null }).eq('created_by_id', userId);
		await supabaseAdmin.from('ladder_memberships').update({ created_by_id: null }).eq('created_by_id', userId);

		// Best-effort avatar cleanup — not required for the auth deletion below.
		try {
			const { data: files } = await supabaseAdmin.storage.from('avatars').list(userId);
			if (files?.length > 0) {
				await supabaseAdmin.storage.from('avatars').remove(files.map(f => `${userId}/${f.name}`));
			}
		} catch (err) {
			console.warn('Avatar cleanup failed for', userId, err?.message);
		}

		const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
		if (deleteError) throw deleteError;

		return res.status(200).json({ success: true });
	} catch (error) {
		console.error('delete-account error:', error);
		return res.status(500).json({ error: error.message });
	}
}
