import { Link, NavLink } from 'react-router-dom';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { CreditCard, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/links', label: 'Links' },
  { to: '/nfc', label: 'NFC' },
  { to: '/analytics', label: 'Analytics' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-nav sticky top-0 z-40">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="brand-mark">
          <span className="brand-icon">
            <CreditCard size={20} />
          </span>
          <span>OneTapZ</span>
        </Link>

        <button className="btn-icon md:hidden" type="button" onClick={() => setOpen((value) => !value)}>
          <Menu size={20} />
        </button>

        <div className="hidden items-center gap-2 md:flex">
          {user &&
            navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className="nav-link">
                {item.label}
              </NavLink>
            ))}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className="nav-link">
              Admin
            </NavLink>
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Show when="signed-out">
            <SignInButton forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard">
              <button className="btn-ghost" type="button">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard">
              <button className="btn-primary" type="button">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
          {user && (
            <button className="btn-ghost" type="button" onClick={logout}>
              <LogOut size={16} />
              Logout
            </button>
          )}
        </div>
      </nav>

      {open && (
        <div className="mobile-menu space-y-2 px-4 py-4 md:hidden">
          {user ? (
            <>
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className="mobile-nav-link" onClick={() => setOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
              <button className="btn-ghost w-full justify-center" type="button" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <SignInButton forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard">
                <button className="btn-ghost w-full justify-center" type="button" onClick={() => setOpen(false)}>
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard">
                <button className="btn-primary w-full justify-center" type="button" onClick={() => setOpen(false)}>
                  Sign up
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      )}
    </header>
  );
}
