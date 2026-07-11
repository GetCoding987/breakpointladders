import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatEasternDateTime } from '@/utils/easternTime';

const typeIcons = {
  challenge_received: '⚔️',
  challenge_accepted: '✅',
  challenge_declined: '❌',
  score_submitted: '📝',
  score_confirmed: '🏆',
  score_disputed: '⚠️',
  membership_expiring: '⏰',
  membership_expired: '🔒',
  rank_updated: '📈',
  new_message: '💬',
};

export default function NotificationsPage() {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const u = await base44.auth.me();
    setUser(u);
    const notifs = await base44.entities.Notification.filter({ user_id: u.id });
    setNotifications(notifs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setLoading(false);
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await base44.entities.Notification.update(n.id, { read: true });
    }
    load();
  };

  const markRead = async (notif) => {
    if (!notif.read) {
      await base44.entities.Notification.update(notif.id, { read: true });
      load();
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-[hsl(217,72%,40%)] rounded-full animate-spin" />
    </div>
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-muted-foreground text-sm mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllRead} className="gap-2 text-sm">
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.map(notif => (
          <div
            key={notif.id}
            onClick={() => markRead(notif)}
            className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-sm ${
              notif.read ? 'bg-white border-border' : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="text-2xl flex-shrink-0 mt-0.5">
              {typeIcons[notif.type] || '🔔'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${notif.read ? '' : 'text-blue-900'}`}>{notif.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{notif.body}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {notif.created_date ? formatEasternDateTime(notif.created_date) : ''}
              </p>
            </div>
            {!notif.read && (
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
            )}
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="bg-white rounded-2xl border border-border p-12 text-center">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}