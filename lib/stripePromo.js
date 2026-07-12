// PROMO_CODES env var format: "CODE:PERCENT,CODE2:PERCENT2" — percent omitted means 100% off.
export function findPromoCode(promoCode) {
	if (!promoCode) return null;
	const codes = (process.env.PROMO_CODES || '')
		.split(',')
		.map((entry) => {
			const [code, pct] = entry.split(':').map((s) => s.trim());
			return { code: code?.toUpperCase(), discount_percent: pct ? parseInt(pct, 10) : 100 };
		})
		.filter((c) => c.code);
	return codes.find((c) => c.code === promoCode.trim().toUpperCase()) || null;
}
