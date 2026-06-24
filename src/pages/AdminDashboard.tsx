import { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { AdminStats } from '../components/admin/AdminStats';
import { AdminUsers } from '../components/admin/AdminUsers';
import { AdminOrders } from '../components/admin/AdminOrders';
import { AdminCards } from '../components/admin/AdminCards';
import { AdminProducts } from '../components/admin/AdminProducts';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Products' },
  { id: 'cards', label: 'NFC Cards' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AdminDashboard() {
  const [tab, setTab] = useState<TabId>('overview');

  return (
    <DashboardLayout title="Admin dashboard">
      <div className="profile-tabs mb-6" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={`profile-tab ${tab === item.id ? 'active' : ''}`}
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <AdminStats />}
      {tab === 'users' && <AdminUsers />}
      {tab === 'orders' && <AdminOrders />}
      {tab === 'products' && <AdminProducts />}
      {tab === 'cards' && <AdminCards />}
    </DashboardLayout>
  );
}
