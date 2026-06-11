import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AdminStats as AdminStatsData } from '../../lib/types';

export function AdminStats() {
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/stats')
      .then(({ data }) => setStats(data.stats))
      .catch(() => setError('Could not load stats.'));
  }, []);

  if (error) return <p className="text-sm text-slate-400">{error}</p>;
  if (!stats) return <p className="text-sm text-slate-400">Loading…</p>;

  const cards: { label: string; value: string | number; hint?: string }[] = [
    { label: 'Users', value: stats.totalUsers, hint: `+${stats.newUsers7d} this week` },
    { label: 'Links', value: stats.totalLinks },
    { label: 'Profile views', value: stats.profileViews },
    { label: 'Link clicks', value: stats.linkClicks },
    { label: 'NFC taps', value: stats.tapCount },
    { label: 'Paid orders', value: stats.orders.paid, hint: `${stats.orders.pending} pending` },
    { label: 'Revenue', value: `$${stats.revenue.toFixed(2)}` },
  ];

  return (
    <section className="panel p-6">
      <div className="metric-grid">
        {cards.map((card) => (
          <div key={card.label} className="metric-card">
            <p className="metric-value">{card.value}</p>
            <p className="metric-label">{card.label}</p>
            {card.hint && <p className="metric-hint">{card.hint}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
