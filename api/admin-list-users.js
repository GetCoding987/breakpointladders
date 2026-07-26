import { supabaseAdmin, getUserFromRequest } from '../lib/supabaseAdmin.js';

// Real emails only live on auth.users, which client-side code can't read
// (no PostgREST access, and profiles doesn't duplicate it) — this endpoint
// uses the service role to join profiles + auth emails + ladder membership
// for every user, admin-only.
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

		const { data: profiles, error: profilesError } = await supabaseAdmin.from('profiles').select('*');
		if (profilesError) throw profilesError;

		const emailById = {};
		let page = 1;
		while (true) {
			const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
			if (listError) throw listError;
			data.users.forEach(u => { emailById[u.id] = u.email; });
			if (data.users.length < 1000) break;
			page++;
		}

		const { data: memberships } = await supabaseAdmin.from('ladder_memberships').select('user_id, ladder_id, status');
		const { data: ladders } = await supabaseAdmin.from('ladders').select('id, name');
		const ladderNameById = Object.fromEntries((ladders || []).map(l => [l.id, l.name]));
		const membershipsByUser = {};
		(memberships || []).forEach(m => {
			if (!membershipsByUser[m.user_id]) membershipsByUser[m.user_id] = [];
			membershipsByUser[m.user_id].push({ ladder_name: ladderNameById[m.ladder_id] || 'Unknown Ladder', status: m.status });
		});

		const users = (profiles || []).map(p => ({
			...p,
			email: emailById[p.id] || null,
			ladders: membershipsByUser[p.id] || [],
		}));

		return res.status(200).json({ users });
	} catch (error) {
		console.error('admin-list-users error:', error);
		return res.status(500).json({ error: error.message });
	}
}
