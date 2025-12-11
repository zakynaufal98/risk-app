// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';

const SIGNED_OUT_KEY = 'signed_out_at';
const LOGIN_AT_KEY = 'login_at';

const isValidSession = (session) => {
  if (!session) return false;

  // Supabase v2: getSession returns { user, ... } inside session; sometimes you pass the raw session object or custom object
  if (typeof session === 'object') {
    if (session.user) return true;
    // sometimes you store the session itself under session.session or similar
    if (session.session && session.session.user) return true;
    // if you stored a user object directly
    if (session.id || session.user_id || session.email) return true;
  }

  return false;
};

const ProtectedRoute = ({ session, children }) => {
  const location = useLocation();

  try {
    // Jika tanda signed_out_at ada -> segera blokir akses (sinkron antar-tab)
    const signedOutAt = Number(localStorage.getItem(SIGNED_OUT_KEY) || 0);
    const loginAt = Number(localStorage.getItem(LOGIN_AT_KEY) || 0);
    if (signedOutAt && (!loginAt || signedOutAt >= loginAt)) {
      // ada tanda sign out yang lebih baru dari login -> treat as logged out
      return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
    }
  } catch (_) {
    // ignore storage read errors
  }

  if (!isValidSession(session)) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedRoute;
