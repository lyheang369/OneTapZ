import { SignIn } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { user, loading } = useAuth();

  if (loading) {
    return <main className="auth-page text-slate-300">Loading...</main>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="auth-page">
      <div className="clerk-panel">
        <SignIn forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard" />
      </div>
    </main>
  );
}
