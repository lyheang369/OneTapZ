import { Navigate } from 'react-router-dom';

// ponytail: email/password signup disabled — Telegram is the only login. Route
// kept so old /register links (Home CTA) don't 404; folds into /login.
export function Register() {
  return <Navigate to="/login" replace />;
}
