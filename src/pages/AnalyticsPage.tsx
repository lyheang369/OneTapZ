import { useEffect, useState } from 'react';
import { BarChart3, Eye, Link2, MousePointerClick } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { StatCard } from '../components/StatCard';
import { api, hasApiSession } from '../lib/api';
import type { Analytics, LinkItem } from '../lib/types';

const emptyAnalytics: Analytics = { profileViews: 0, linkClicks: 0, tapCount: 0 };

export function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics>(emptyAnalytics);
  const [topLink, setTopLink] = useState<LinkItem | null>(null);

  useEffect(() => {
    if (!hasApiSession()) return;
    api
      .get('/analytics/me')
      .then(({ data }) => {
        setAnalytics(data.analytics ?? emptyAnalytics);
        setTopLink(data.mostClickedLink ?? null);
      })
      .catch(() => {});
  }, []);

  return (
    <DashboardLayout title="Analytics">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Profile views" value={analytics.profileViews} icon={Eye} />
        <StatCard label="Link clicks" value={analytics.linkClicks} icon={MousePointerClick} />
        <StatCard label="Total taps" value={analytics.tapCount} icon={BarChart3} />
      </div>
      <div className="mt-6 panel p-6">
        <div className="flex items-center gap-2 text-sky-300">
          <Link2 size={18} />
          Most clicked link
        </div>
        {topLink ? (
          <>
            <h2 className="mt-3 text-2xl font-black text-white">{topLink.title}</h2>
            <p className="mt-1 text-slate-400">{topLink.clickCount} clicks</p>
          </>
        ) : (
          <p className="mt-3 text-slate-400">No link clicks yet. Share your profile to start tracking.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
