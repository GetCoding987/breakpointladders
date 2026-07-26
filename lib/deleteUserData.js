// Most auth.users FKs across the schema have no cascade/set-null (challenges,
// matches, messages, group conversations, and a handful of created_by_id
// columns), so deleting the auth.users row directly would fail with FK
// violations for almost any real user. Everything referencing this user must
// be cleared first; only profiles/ladder_memberships/notifications (by
// user_id) cascade automatically once the auth.users row is gone.
export async function deleteUserCompletely(supabaseAdmin, userId) {
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
			await supabaseAdmin.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`));
		}
	} catch (err) {
		console.warn('Avatar cleanup failed for', userId, err?.message);
	}

	const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
	if (!deleteError) return;

	// Occasionally GoTrue's hard-delete 500s for a specific user (seen with a
	// stale/orphaned row in Supabase's internal auth schema, outside our
	// control) even though nothing in our own schema blocks it. Soft-delete
	// still disables their login, so fall back to that and manually clean up
	// the rows that would normally cascade from a hard delete.
	console.warn(`Hard delete failed for ${userId}, falling back to soft delete:`, deleteError.message);
	const { error: softDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId, true);
	if (softDeleteError) throw softDeleteError;

	await supabaseAdmin.from('ladder_memberships').delete().eq('user_id', userId);
	await supabaseAdmin.from('notifications').delete().eq('user_id', userId);
	await supabaseAdmin.from('profiles').delete().eq('id', userId);
}
