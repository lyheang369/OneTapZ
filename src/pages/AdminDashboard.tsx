import { Shield, ToggleLeft, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { demoCard, demoUser } from '../data/demo';

export function AdminDashboard() {
  const users = [demoUser, { ...demoUser, id: '2', name: 'Nika Chen', username: 'nika', email: 'nika@example.com', isActive: true }];
  const cards = [demoCard, { ...demoCard, _id: '2', cardId: 'OTZ-2026-188', isActive: false }];

  return (
    <DashboardLayout title="Admin dashboard">
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-6">
          <div className="mb-4 flex items-center gap-2 text-sky-300">
            <Shield size={18} />
            Users
          </div>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="admin-row">
                <div>
                  <p className="font-bold text-white">{user.name}</p>
                  <p className="text-sm text-slate-400">@{user.username}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-icon" type="button">
                    <ToggleLeft size={17} />
                  </button>
                  <button className="btn-icon" type="button">
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel p-6">
          <h2 className="mb-4 text-xl font-bold text-white">NFC cards</h2>
          <div className="space-y-3">
            {cards.map((card) => (
              <div key={card._id} className="admin-row">
                <div>
                  <p className="font-bold text-white">{card.cardId}</p>
                  <p className="text-sm text-slate-400">{card.profileUrl}</p>
                </div>
                <span className={card.isActive ? 'status-on' : 'status-off'}>{card.isActive ? 'active' : 'inactive'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
