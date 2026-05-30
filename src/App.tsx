import { Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminDashboard } from './pages/AdminDashboard';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { Dashboard } from './pages/Dashboard';
import { EditProfile } from './pages/EditProfile';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { ManageLinks } from './pages/ManageLinks';
import { NfcCardPage } from './pages/NfcCardPage';
import { NotFound } from './pages/NotFound';
import { PublicProfile } from './pages/PublicProfile';
import { Register } from './pages/Register';

function App() {
  const location = useLocation();
  const appRoutes = new Set(['/login', '/register', '/dashboard', '/edit-profile', '/links', '/nfc', '/analytics', '/admin']);
  const isPublicProfile = /^\/[a-z0-9_-]+$/i.test(location.pathname) && !appRoutes.has(location.pathname);

  return (
    <>
      {!isPublicProfile && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
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
    </>
  );
}

export default App;
