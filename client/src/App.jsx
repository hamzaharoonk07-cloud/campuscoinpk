import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AppContext.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Privacy from './pages/Privacy.jsx';

import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Udhaar from './pages/Udhaar.jsx';
import Budgets from './pages/Budgets.jsx';
import Reports from './pages/Reports.jsx';
import Insights from './pages/Insights.jsx';
import Calendar from './pages/Calendar.jsx';
import Tips from './pages/Tips.jsx';
import Categories from './pages/Categories.jsx';
import Settings from './pages/Settings.jsx';

import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminStudents from './pages/admin/AdminStudents.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminAnnouncements from './pages/admin/AdminAnnouncements.jsx';
import Loader from './components/Loader.jsx';
import RequireProfile from './components/RequireProfile.jsx';

/** While the saved sign-in is checked: the branded loader (components/Loader.jsx). */
const Loading = () => <Loader />;

/** Keeps a page behind the sign-in wall, remembering where the visitor wanted to go. */
function Protected({ children, admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) return <Navigate to={admin ? '/admin/login' : '/login'} state={{ from: location.pathname }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  // An administrator has no student dashboard, so send them where they belong.
  if (!admin && user.role === 'admin') return <Navigate to="/admin" replace />;
  // Only a Google sign-up hits this - it skips the usual signup form
  // entirely, so it is asked once, right after, instead of before. An
  // account that already completed signup (including an old one that
  // predates the phone field) is never interrupted by this again.
  if (!admin && !user.profileComplete) return <RequireProfile />;

  return children;
}

/** A visitor who is already signed in should not see the sign-in form again. */
function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/admin/login" element={<PublicOnly><AdminLogin /></PublicOnly>} />

      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
      <Route path="/udhaar" element={<Protected><Udhaar /></Protected>} />
      <Route path="/budgets" element={<Protected><Budgets /></Protected>} />
      <Route path="/reports" element={<Protected><Reports /></Protected>} />
      <Route path="/insights" element={<Protected><Insights /></Protected>} />
      <Route path="/calendar" element={<Protected><Calendar /></Protected>} />
      <Route path="/tips" element={<Protected><Tips /></Protected>} />
      <Route path="/categories" element={<Protected><Categories /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />

      <Route path="/admin" element={<Protected admin><AdminOverview /></Protected>} />
      <Route path="/admin/students" element={<Protected admin><AdminStudents /></Protected>} />
      <Route path="/admin/categories" element={<Protected admin><AdminCategories /></Protected>} />
      <Route path="/admin/announcements" element={<Protected admin><AdminAnnouncements /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
