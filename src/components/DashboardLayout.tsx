import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, CreditCard, Forward, LayoutDashboard, Link2, UserPen } from 'lucide-react';

const items = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/edit-profile', label: 'Edit profile', icon: UserPen },
  { to: '/links', label: 'Manage links', icon: Link2 },
  { to: '/redirects', label: 'Redirects', icon: Forward },
  { to: '/nfc', label: 'NFC card', icon: CreditCard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function DashboardLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="page-shell grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="panel hidden h-fit p-3 lg:block">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className="side-link">
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </aside>
      <section className="min-w-0">
        <nav className="dash-tabs lg:hidden" aria-label="Dashboard sections">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className="side-link">
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mb-6">
          <p className="eyebrow">Creator dashboard</p>
          <h1 className="section-title">{title}</h1>
        </div>
        {children}
      </section>
    </main>
  );
}
