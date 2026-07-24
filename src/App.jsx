import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProtectedRoute from '@/components/ProtectedRoute';

// Pages
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LadderPage from './pages/LadderPage';
import ChallengesPage from './pages/ChallengesPage';
import MatchesPage from './pages/MatchesPage';
import MessagesPage from './pages/MessagesPage';

import ProfilePage from './pages/ProfilePage';
import PlayerProfilePage from './pages/PlayerProfilePage';
import AdminPage from './pages/AdminPage';
import NotificationsPage from './pages/NotificationsPage';
import JoinLadder from './pages/JoinLadder';
import PaymentSuccess from './pages/PaymentSuccess';
import RulesPage from './pages/RulesPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[hsl(217,72%,40%)] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/join" element={<JoinLadder />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/complete-profile" element={<Navigate to="/login" replace />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ladder" element={<LadderPage />} />
          <Route path="/challenges" element={<ChallengesPage />} />
          <Route path="/challenges/new" element={<ChallengesPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/matches/submit" element={<MatchesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/players/:userId" element={<PlayerProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/rules" element={<RulesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App;