import { BarChart3, Eye, Link2, MousePointerClick } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { StatCard } from '../components/StatCard';
import { demoAnalytics, demoLinks } from '../data/demo';

export function AnalyticsPage() {
  const topLink = [...demoLinks].sort((a, b) => b.clickCount - a.clickCount)[0];

  return (
    <DashboardLayout title="Analytics">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Profile views" value={demoAnalytics.profileViews} icon={Eye} />
        <StatCard label="Link clicks" value={demoAnalytics.linkClicks} icon={MousePointerClick} />
        <StatCard label="Total taps" value={demoAnalytics.tapCount} icon={BarChart3} />
      </div>
      <div className="mt-6 panel p-6">
        <div className="flex items-center gap-2 text-sky-300">
          <Link2 size={18} />
          Most clicked link
        </div>
        <h2 className="mt-3 text-2xl font-black text-white">{topLink.title}</h2>
        <p className="mt-1 text-slate-400">{topLink.clickCount} clicks</p>
      </div>
    </DashboardLayout>
  );
}
