// BreakPoint seasons: Spring (Mar 1 - Jun 30), Summer/Fall (Jul 1 - Oct 31).
// Off-season (Nov-Feb): membership expires at end of next Spring season.
// Mirrors src/utils/seasons.js — kept as a separate copy since Vercel
// functions and the Vite frontend are different build targets.
export function getSeasonExpiryString(date = new Date()) {
	const month = date.getMonth();
	let expiryDate;
	if (month >= 2 && month <= 5) {
		expiryDate = new Date(date.getFullYear(), 5, 30);
	} else if (month >= 6 && month <= 9) {
		expiryDate = new Date(date.getFullYear(), 9, 31);
	} else if (month >= 10) {
		expiryDate = new Date(date.getFullYear() + 1, 5, 30);
	} else {
		expiryDate = new Date(date.getFullYear(), 5, 30);
	}
	return expiryDate.toISOString().split('T')[0];
}
