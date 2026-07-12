import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
	import.meta.env.VITE_SUPABASE_URL,
	import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function callApi(path, body) {
	const { data: { session } } = await supabase.auth.getSession();
	const res = await fetch(path, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
		},
		body: JSON.stringify(body),
	});
	const json = await res.json();
	if (!res.ok) {
		throw new Error(json.error || 'Request failed');
	}
	return json;
}

export async function getCurrentUser() {
	const { data: { user: authUser } } = await supabase.auth.getUser();
	if (!authUser) return null;

	const { data: profile, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', authUser.id)
		.single();
	if (error) throw error;

	return {
		...profile,
		id: authUser.id,
		email: authUser.email,
	};
}
