export default function RankBadge({ rank, size = 'md' }) {
  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const getStyle = (rank) => {
    if (rank === 1) return 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-300 shadow-lg shadow-yellow-200';
    if (rank === 2) return 'bg-slate-300 text-slate-700 ring-2 ring-slate-200';
    if (rank === 3) return 'bg-amber-600 text-amber-100 ring-2 ring-amber-400';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className={`${sizes[size]} ${getStyle(rank)} rounded-full flex items-center justify-center font-bold flex-shrink-0`}>
      {rank <= 3 && rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
    </div>
  );
}