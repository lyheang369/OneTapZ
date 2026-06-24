import { Link, NavLink } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { BrandMark } from './BrandMark';
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
            <BrandMark size={22} />
          </span>
          <span>OneTapZ</span>
        </Link>

        <button className="btn-icon nav-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-label="Open menu">
          <Menu size={20} />
        </button>

        <div className="desktop-nav">
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

        <div className="desktop-auth">
          <NavLink to="/shop" className="nav-link">
            Shop
          </NavLink>
          {!user && (
            <>
              <Link className="btn-ghost" to="/login">
                Sign in
              </Link>
              <Link className="btn-primary" to="/register">
                Sign up
              </Link>
            </>
          )}
          {user && (
            <>
              <span className="user-pill">{user.name.charAt(0).toUpperCase()}</span>
              <button className="btn-ghost" type="button" onClick={logout}>
                <LogOut size={16} />
                Logout
              </button>
            </>
          )}
        </div>
      </nav>

      {open && (
        <div className="mobile-menu space-y-2 px-4 py-4 md:hidden">
          <NavLink to="/shop" className="mobile-nav-link" onClick={() => setOpen(false)}>
            Shop
          </NavLink>
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
              <Link className="btn-ghost w-full justify-center" to="/login" onClick={() => setOpen(false)}>
                Sign in
              </Link>
              <Link className="btn-primary w-full justify-center" to="/register" onClick={() => setOpen(false)}>
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
