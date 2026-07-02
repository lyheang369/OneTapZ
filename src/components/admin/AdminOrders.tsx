import { useEffect, useState } from 'react';
import { Download, Package, Search, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { ORDER_STAGES, stageLabel, type Order, type OrderStage } from '../../lib/types';

const STATUS_FILTERS = ['all', 'pending', 'paid', 'expired'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
type StageFilter = 'all' | OrderStage;

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [query, setQuery] = useState('');
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [unshippedOnly, setUnshippedOnly] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  function filterQuery() {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (stageFilter !== 'all') params.set('stage', stageFilter);
    if (query.trim()) params.set('q', query.trim());
    if (unshippedOnly) params.set('fulfilled', 'false');
    return params.toString();
  }

  useEffect(() => {
    // Small debounce so typing in the search box doesn't fire per keystroke.
    const t = window.setTimeout(() => {
      api
        .get(`/admin/orders?${filterQuery()}`)
        .then(({ data }) => {
          setOrders(data.orders ?? []);
          setStageCounts(data.stageCounts ?? {});
          setError('');
        })
        .catch(() => setError('Could not load orders.'));
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stageFilter, query, unshippedOnly]);

  const replace = (updated: Order) => setOrders((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));

  async function setStage(order: Order, stage: OrderStage) {
    setBusy(order._id + stage);
    try {
      const { data } = await api.put(`/admin/orders/${order._id}/stage`, { stage });
      replace(data.order);
    } finally {
      setBusy('');
    }
  }

  async function sendMessage(order: Order) {
    const text = (drafts[order._id] || '').trim();
    if (!text) return;
    setBusy(order._id + 'msg');
    try {
      const { data } = await api.post(`/admin/orders/${order._id}/message`, { text });
      replace(data.order);
      setDrafts((d) => ({ ...d, [order._id]: '' }));
    } catch {
      setError('Could not send message (buyer may have no Telegram).');
    } finally {
      setBusy('');
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      // Auth-gated endpoint: fetch as a blob through `api` (carries the bearer
      // token) rather than a plain link, then trigger a client-side download.
      const { data } = await api.get(`/admin/orders.csv?${filterQuery()}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `onetapz-orders-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="panel p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sky-300">
          <Package size={18} />
          Shop orders
        </div>
        <div className="profile-tabs" role="tablist" style={{ maxWidth: 360 }}>
          {STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              className={`profile-tab ${status === value ? 'active' : ''}`}
              aria-selected={status === value}
              onClick={() => setStatus(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={unshippedOnly} onChange={(e) => setUnshippedOnly(e.target.checked)} />
          Unshipped only
        </label>
        <button className="btn-text" type="button" disabled={exporting} onClick={exportCsv}>
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Search + fulfillment pipeline overview (counts of paid orders per stage). */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative block" style={{ minWidth: 260, flex: '1 1 260px' }}>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input w-full"
            style={{ paddingLeft: '2.2rem' }}
            placeholder="Search reference, buyer or @handle…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${stageFilter === 'all' ? 'btn-primary' : 'btn-text'} justify-center`}
            onClick={() => setStageFilter('all')}
          >
            All stages
          </button>
          {ORDER_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              className={`${stageFilter === s ? 'btn-primary' : 'btn-text'} justify-center`}
              onClick={() => setStageFilter((cur) => (cur === s ? 'all' : s))}
            >
              {stageLabel(s)} · {stageCounts[s] ?? 0}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-slate-400">{error}</p>}
      <div className="space-y-3">
        {!error && orders.length === 0 && <p className="text-sm text-slate-400">No orders found.</p>}
        {orders.map((order) => (
          <div key={order._id} className="admin-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="min-w-0">
              <p className="font-bold text-white">
                {order.items.map((i) => `${i.name} ×${i.qty}`).join(', ')} · ${order.amount.toFixed(2)}
              </p>
              <p className="text-sm text-slate-400">
                {[order.customer.name, order.customer.phone].filter(Boolean).join(' · ')}
                {order.telegramUsername && (
                  <>
                    {order.customer.name || order.customer.phone ? ' · ' : ''}
                    <a
                      className="text-sky-300"
                      href={`https://t.me/${order.telegramUsername}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{order.telegramUsername}
                    </a>
                  </>
                )}
              </p>
              {order.cardDesign?.template && (
                <p className="text-sm text-slate-400">
                  🎨 {order.cardDesign.template}
                  {order.cardDesign.name ? ` — “${order.cardDesign.name}”` : ''}
                  {order.cardDesign.handle ? ` · @${order.cardDesign.handle}` : ''}
                </p>
              )}
              {order.delivery?.method === 'delivery' ? (
                <p className="text-sm text-slate-400">
                  🚚 {order.delivery.area === 'province' ? `Province · ${order.delivery.courier}` : 'Phnom Penh'} — {order.delivery.address}
                </p>
              ) : (
                <p className="text-sm text-slate-400">🏠 Pickup at CamTech</p>
              )}
              <p className="text-xs text-slate-500">
                {order.reference} · {order.createdAt ? new Date(order.createdAt).toLocaleString() : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={order.status === 'paid' ? 'status-on' : 'status-off'}>{order.status}</span>
            </div>

            {order.status === 'paid' && (
              <div style={{ flexBasis: '100%' }} className="mt-2 border-t border-white/10 pt-3">
                {/* Fulfillment stage controls */}
                <p className="field-label">Fulfillment stage</p>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STAGES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy === order._id + s}
                      className={`${order.stage === s ? 'btn-primary' : 'btn-text'} justify-center`}
                      onClick={() => setStage(order, s)}
                    >
                      {stageLabel(s, order.delivery?.method)}
                    </button>
                  ))}
                </div>

                {/* Message thread */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-sky-300">
                    Messages ({order.messages?.length ?? 0})
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {(order.messages ?? []).map((m, idx) => (
                      <div
                        key={idx}
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          m.from === 'admin' ? 'self-end bg-sky-500/15 text-white' : 'self-start bg-white/10 text-slate-200'
                        }`}
                      >
                        {m.text}
                        <span className="ml-2 text-[10px] text-slate-500">{new Date(m.at).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="mt-1 flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder="Message the buyer on Telegram…"
                        value={drafts[order._id] || ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [order._id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage(order)}
                      />
                      <button
                        className="btn-primary"
                        type="button"
                        disabled={busy === order._id + 'msg'}
                        onClick={() => sendMessage(order)}
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
