// Promo codes are managed from the admin panel (promo_codes table) instead
// of a Vercel env var.
export async function findPromoCode(supabaseAdmin, promoCode) {
	if (!promoCode) return null;
	const { data } = await supabaseAdmin
		.from('promo_codes')
		.select('*')
		.ilike('code', promoCode.trim())
		.eq('active', true)
		.maybeSingle();
	return data || null;
}
