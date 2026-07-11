/**
 * Formats a raw name string that might be an email-style username
 * (e.g. "kiran.vira" or "kiran_vira") into "Kiran Vira".
 */
export function formatName(name) {
  if (!name) return 'Unknown';
  // If no spaces but has dots/underscores, treat as email-style username
  if (!name.includes(' ') && (name.includes('.') || name.includes('_'))) {
    return name
      .split(/[._]/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return name;
}

/**
 * Returns the best display name for a user or membership object.
 * Prefers first_name + last_name, falls back to full_name / display_name
 * with email-style formatting applied.
 */
export function getDisplayName(user) {
  if (!user) return 'Unknown';
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  if (user.first_name) return user.first_name;
  return formatName(user.full_name || user.display_name);
}