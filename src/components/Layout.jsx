import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { getDisplayName } from '@/utils/userHelpers';
import {
  LayoutDashboard, Trophy, Swords, Activity, MessageSquare,
  Users, User, Settings, LogOut, Bell, Menu, BookOpen
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingChallenges, setPendingChallenges] = useState(0);
  const [pendingScores, setPendingScores] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const loadCounts = async () => {
      try {
        const [{ data: msgs }, { data: notifs }, { data: challenges }, { data: myMems }] = await Promise.all([
          supabase.from('messages').select('*').match({ recipient_id: user.id, read: false }),
          supabase.from('notifications').select('*').match({ user_id: user.id, read: false }),
          supabase.from('challenges').select('*').match({ opponent_id: user.id, status: 'pending' }),
          supabase.from('ladder_memberships').select('*').match({ user_id: user.id }),
        ]);
        setUnreadMessages(msgs?.length || 0);
        setUnreadNotifications(notifs?.length || 0);
        setPendingChallenges(challenges?.length || 0);

        // Pending score confirmations: matches where I'm not the submitter and status is pending
        if (myMems?.length > 0) {
          const { data: allMatches } = await supabase.from('matches').select('*').match({ ladder_id: myMems[0].ladder_id });
          const needConfirm = (allMatches || []).filter(m =>
            (m.player1_id === user.id || m.player2_id === user.id) &&
            m.status === 'pending_confirmation' &&
            m.submitted_by_id !== user.id
          );
          setPendingScores(needConfirm.length);
        }
      } catch (err) {
        // Rate limit or transient error — badge counts are non-critical, fail silently
        console.warn('Layout count load failed:', err?.message);
      }
    };
    loadCounts();
    // Auto-refresh counts when notifications or messages change (e.g. marked as read)
    let debounceTimer;
    const debouncedLoad = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadCounts(), 500);
    };
    const channel = supabase
      .channel(`layout-badges-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` }, debouncedLoad)
      .subscribe();
    return () => { clearTimeout(debounceTimer); supabase.removeChannel(channel); };
  }, [user]);

  // Redirect users with incomplete profiles to complete-profile page
  useEffect(() => {
    if (!user) return;
    const missingProfile = !user.gender || !user.city || !user.state || !user.ntrp_rating;
    if (missingProfile && location.pathname !== '/complete-profile' && location.pathname !== '/profile') {
      navigate('/complete-profile');
    }
  }, [user, location.pathname, navigate]);

  const handleLogout = () => { logout(); };
  const isAdmin = user?.role === 'admin';
  const displayName = getDisplayName(user);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/ladder', label: 'Ladders', icon: Trophy },
    { path: '/challenges', label: 'Challenges', icon: Swords, alert: pendingChallenges > 0, clearAlert: () => setPendingChallenges(0) },
    { path: '/matches', label: 'Matches', icon: Activity, alert: pendingScores > 0, clearAlert: () => setPendingScores(0) },
    { path: '/messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages, alert: unreadMessages > 0, clearAlert: () => setUnreadMessages(0) },
    { path: '/rules', label: 'Rules', icon: BookOpen },
    ...(isAdmin ? [{ path: '/admin', label: 'Admin', icon: Settings }] : []),
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-1 py-2 border-b border-white/10">
        <Link to="/" className="flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Break Point Westchester"
            className="w-[90%] h-auto"
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon, badge, alert, clearAlert }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              onClick={() => { setSidebarOpen(false); clearAlert?.(); }}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-200 group ${
                active ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[hsl(142,50%,60%)]' : 'group-hover:text-white/80'}`} />
              <span className="font-medium text-xs">{label}</span>
              {badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              {active && !badge && (
                <div className={`ml-auto w-1.5 h-1.5 rounded-full ${alert ? 'bg-red-400' : 'bg-[hsl(142,50%,60%)]'}`} />
              )}
              {!active && alert && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {user && (
        <div className="p-2 border-t border-white/10">
          <div className="flex items-center gap-2 px-1.5 mb-2">
            <div className="w-7 h-7 rounded-full bg-white/20 overflow-hidden flex-shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs">
                  {displayName?.[0] || 'P'}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">{displayName}</div>
              <div className="text-white/50 text-[10px] capitalize">{user.role}</div>
            </div>
            <Link to="/profile" className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
              <Settings className="w-3.5 h-3.5" />
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log Out
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col flex-shrink-0 sidebar-nav">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-56 h-full sidebar-nav">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-border px-4 py-2.5 flex items-center justify-between flex-shrink-0">
          <button className="md:hidden p-3 rounded-lg hover:bg-muted transition-colors" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <Link to="/notifications" onClick={() => setUnreadNotifications(0)} className="relative p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Bell className="w-4 h-4 text-muted-foreground" />
              {unreadNotifications > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
            <Link to="/messages" className="relative p-1.5 rounded-lg hover:bg-muted transition-colors">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              {unreadMessages > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}