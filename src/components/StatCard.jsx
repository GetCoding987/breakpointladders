export default function StatCard({ icon: Icon, label, value, sub, color = 'navy', trend }) {
  const colors = {
    navy: 'text-[hsl(217,72%,40%)] bg-blue-50',
    green: 'text-[hsl(142,50%,40%)] bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    orange: 'text-orange-600 bg-orange-50',
  };

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-border hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
          <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          {trend && (
            <p className="text-[11px] font-semibold text-green-600 mt-0.5">{trend}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}