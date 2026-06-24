import { useEffect, useState } from 'react';
import { Copy, Eye, Link2, MousePointerClick, Plus, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { PhonePreview } from '../components/PhonePreview';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { api, hasApiSession, publicProfileUrl } from '../lib/api';
import { readLocalLinks } from '../lib/localStore';
import type { Analytics, LinkItem } from '../lib/types';

const emptyAnalytics: Analytics = { profileViews: 0, linkClicks: 0, tapCount: 0 };

export function Dashboard() {
  const { user } = useAuth();
  const profileUrl = publicProfileUrl(user?.username || '');
  const [analytics, setAnalytics] = useState<Analytics>(emptyAnalytics);
  // Local-fallback links are read synchronously on first render; API links are
  // fetched in the effect below. ProtectedRoute guarantees `user` is set here.
  const [links, setLinks] = useState<LinkItem[]>(() => (user && !hasApiSession() ? readLocalLinks(user.id) : []));

  useEffect(() => {
    if (!user || !hasApiSession()) return;
    api.get('/analytics/me').then(({ data }) => setAnalytics(data.analytics ?? emptyAnalytics)).catch(() => {});
    api.get('/links').then(({ data }) => setLinks(data.links ?? [])).catch(() => {});
  }, [user]);

  if (!user) return null;

  return (
    <DashboardLayout title="Overview">
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Profile views" value={analytics.profileViews} icon={Eye} />
            <StatCard label="Link clicks" value={analytics.linkClicks} icon={MousePointerClick} />
            <StatCard label="Total taps" value={analytics.tapCount} icon={QrCode} />
          </div>
          <div className="panel p-6">
            <p className="eyebrow">Public link</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input className="input" readOnly value={profileUrl} />
              <button className="btn-primary" type="button" onClick={() => navigator.clipboard.writeText(profileUrl)}>
                <Copy size={17} />
                Copy
              </button>
            </div>
          </div>
          <div className="panel p-6">
            <h2 className="text-xl font-bold text-white">Create your profile links</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Start by adding the links you want people to open after they tap your NFC card or scan your QR code.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Link className="quick-action" to="/links">
                <Plus size={17} />
                Create link
              </Link>
              <Link className="quick-action" to="/edit-profile">
                Edit profile
              </Link>
              <Link className="quick-action" to={`/${user.username}`}>
                Preview public page
              </Link>
            </div>
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
            <Link2 size={16} />
            Live profile preview
          </div>
          <PhonePreview user={user} links={links} />
        </div>
      </div>
    </DashboardLayout>
  );
}
