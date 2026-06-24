import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

// Code-split every route so a public-profile visitor (the NFC/QR target) only
// downloads the PublicProfile chunk, not the whole dashboard/admin app.
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const EditProfile = lazy(() => import('./pages/EditProfile').then((m) => ({ default: m.EditProfile })));
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const ManageLinks = lazy(() => import('./pages/ManageLinks').then((m) => ({ default: m.ManageLinks })));
const Redirects = lazy(() => import('./pages/Redirects').then((m) => ({ default: m.Redirects })));
const NfcCardPage = lazy(() => import('./pages/NfcCardPage').then((m) => ({ default: m.NfcCardPage })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));
const PublicProfile = lazy(() => import('./pages/PublicProfile').then((m) => ({ default: m.PublicProfile })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const Shop = lazy(() => import('./pages/Shop').then((m) => ({ default: m.Shop })));
const Invoice = lazy(() => import('./pages/Invoice').then((m) => ({ default: m.Invoice })));

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, pendingOnboard, clearOnboard } = useAuth();
  const appRoutes = new Set(['/login', '/register', '/dashboard', '/edit-profile', '/links', '/redirects', '/nfc', '/analytics', '/admin', '/shop']);
  const isPublicProfile = /^\/[a-z0-9_-]+$/i.test(location.pathname) && !appRoutes.has(location.pathname);

  // Brand-new Telegram Mini App users land on profile setup to pick a username;
  // existing users flow straight to the dashboard.
  useEffect(() => {
    if (user && pendingOnboard) {
      clearOnboard();
      navigate('/edit-profile', { replace: true });
    }
  }, [user, pendingOnboard, clearOnboard, navigate]);

  return (
    <>
      {!isPublicProfile && <Navbar />}
      <Suspense fallback={<div className="page-shell py-20 text-center text-slate-400">Loading…</div>}>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/order/:reference" element={<Invoice />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-profile"
          element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/links"
          element={
            <ProtectedRoute>
              <ManageLinks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/redirects"
          element={
            <ProtectedRoute>
              <Redirects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nfc"
          element={
            <ProtectedRoute>
              <NfcCardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
          <Route path="/:username" element={<PublicProfile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
