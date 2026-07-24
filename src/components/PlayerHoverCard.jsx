import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import PlayerAvatar from '@/components/PlayerAvatar';
import { getDisplayName } from '@/utils/userHelpers';

export default function PlayerHoverCard({ user, children }) {
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-56">
        <div className="mb-2 flex items-center gap-2">
          <PlayerAvatar user={user} size="sm" />
          <p className="text-sm font-semibold">{getDisplayName(user)}</p>
        </div>
        <div className="space-y-1">
          {user?.city && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">City</span>
              <span className="font-medium">{user.city}</span>
            </div>
          )}
          {user?.gender && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Gender</span>
              <span className="font-medium">{user.gender}</span>
            </div>
          )}
          {user?.ntrp_rating && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">NTRP</span>
              <span className="font-medium">{user.ntrp_rating}</span>
            </div>
          )}
          {!user?.city && !user?.gender && !user?.ntrp_rating && (
            <p className="text-xs text-muted-foreground">No additional details yet.</p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
