import { supabaseAdmin, getUserFromRequest } from '../lib/supabaseAdmin.js';

// Finds (or creates) the single shared group conversation between the caller
// and every current admin, used by the "Contact Admin" chat bubble. A group
// conversation counts as "the" admin conversation for this player if every
// other participant in it has role='admin' — this avoids needing a dedicated
// marker column. conversations/conversation_participants normally only allow
// admin-initiated inserts (see 20260726120000_group_conversations.sql), so a
// player creating this for the first time has to go through a service-role
// endpoint, same pattern as every other place ladder_memberships etc. has no
// client insert policy.
export default async function handler(req, res) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const caller = await getUserFromRequest(req);
		if (!caller) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const { data: admins } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
		const adminIds = (admins || []).map(a => a.id).filter(id => id !== caller.id);
		if (adminIds.length === 0) {
			return res.status(400).json({ error: 'No admins are configured yet' });
		}
		const adminIdSet = new Set(adminIds);

		const { data: myParticipant } = await supabaseAdmin
			.from('conversation_participants')
			.select('conversation_id')
			.eq('user_id', caller.id);
		const myConvoIds = (myParticipant || []).map(p => p.conversation_id);

		let conversationId = null;
		if (myConvoIds.length > 0) {
			const { data: allParticipants } = await supabaseAdmin
				.from('conversation_participants')
				.select('conversation_id, user_id')
				.in('conversation_id', myConvoIds);
			const othersByConvo = {};
			(allParticipants || []).forEach(p => {
				if (p.user_id === caller.id) return;
				if (!othersByConvo[p.conversation_id]) othersByConvo[p.conversation_id] = [];
				othersByConvo[p.conversation_id].push(p.user_id);
			});
			const adminConvoId = Object.entries(othersByConvo).find(
				([, others]) => others.length > 0 && others.every(id => adminIdSet.has(id))
			)?.[0];
			if (adminConvoId) {
				conversationId = adminConvoId;
				const existingAdminIds = new Set(othersByConvo[adminConvoId]);
				const missingAdminIds = adminIds.filter(id => !existingAdminIds.has(id));
				if (missingAdminIds.length > 0) {
					await supabaseAdmin.from('conversation_participants').insert(
						missingAdminIds.map(adminId => ({ conversation_id: conversationId, user_id: adminId }))
					);
				}
			}
		}

		if (!conversationId) {
			const { data: convo, error: convoError } = await supabaseAdmin
				.from('conversations')
				.insert({ name: null, created_by: caller.id })
				.select()
				.single();
			if (convoError) throw convoError;
			conversationId = convo.id;

			const participantRows = [caller.id, ...adminIds].map(userId => ({ conversation_id: conversationId, user_id: userId }));
			const { error: participantsError } = await supabaseAdmin.from('conversation_participants').insert(participantRows);
			if (participantsError) throw participantsError;
		}

		return res.status(200).json({ conversation_id: conversationId, admin_ids: adminIds });
	} catch (error) {
		console.error('get-or-create-admin-conversation error:', error);
		return res.status(500).json({ error: error.message });
	}
}
