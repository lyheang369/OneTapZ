import { SignUp } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Register() {
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
        <SignUp forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" signInForceRedirectUrl="/dashboard" />
      </div>
    </main>
  );
}
