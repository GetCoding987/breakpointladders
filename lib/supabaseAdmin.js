import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
	process.env.SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY,
	{ auth: { autoRefreshToken: false, persistSession: false } }
);

export async function getUserFromRequest(req) {
	const authHeader = req.headers.authorization || req.headers.Authorization;
	if (!authHeader?.startsWith('Bearer ')) return null;
	const token = authHeader.slice('Bearer '.length);
	const { data, error } = await supabaseAdmin.auth.getUser(token);
	if (error || !data?.user) return null;
	return data.user;
}
