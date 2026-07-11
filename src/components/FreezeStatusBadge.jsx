import { Snowflake, Clock, Ban } from 'lucide-react';

export default function FreezeStatusBadge({ status }) {
  if (status === 'frozen_voluntary') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
        <Snowflake className="w-3 h-3" /> Frozen
      </span>
    );
  }
  if (status === 'frozen_expired') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
        <Clock className="w-3 h-3" /> Expired
      </span>
    );
  }
  if (status === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
        <Ban className="w-3 h-3" /> Suspended
      </span>
    );
  }
  return null;
}