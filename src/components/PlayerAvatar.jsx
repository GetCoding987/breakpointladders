import { getDisplayName } from '@/utils/userHelpers';

export default function PlayerAvatar({ user, size = 'md', showStatus = false, status }) {
  const sizes = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-sm',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  };

  const displayName = getDisplayName(user);

  const getInitials = (name) => {
    if (!name || name === 'Unknown') return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const statusColors = {
    active: 'bg-green-500',
    frozen_voluntary: 'bg-blue-400',
    frozen_expired: 'bg-red-400',
    inactive: 'bg-gray-400',
  };

  return (
    <div className="relative flex-shrink-0">
      <div className={`${sizes[size]} rounded-full overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center ring-2 ring-white shadow-sm`}>
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-bold">{getInitials(displayName)}</span>
        )}
      </div>
      {showStatus && status && (
        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${statusColors[status] || 'bg-gray-400'} ring-2 ring-white`} />
      )}
    </div>
  );
}