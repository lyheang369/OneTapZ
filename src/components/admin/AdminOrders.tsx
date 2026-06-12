import { useEffect, useState } from 'react';
import { Download, Package } from 'lucide-react';
import { api } from '../../lib/api';
import type { Order } from '../../lib/types';

const STATUS_FILTERS = ['all', 'pending', 'paid', 'expired'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [unshippedOnly, setUnshippedOnly] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  function filterQuery(currentStatus: StatusFilter, currentUnshipped: boolean) {
    const params = new URLSearchParams();
    if (currentStatus !== 'all') params.set('status', currentStatus);
    if (currentUnshipped) params.set('fulfilled', 'false');
    return params.toString();
  }

  useEffect(() => {
    api
      .get(`/admin/orders?${filterQuery(status, unshippedOnly)}`)
      .then(({ data }) => {
        setOrders(data.orders ?? []);
        setError('');
      })
      .catch(() => setError('Could not load orders.'));
  }, [status, unshippedOnly]);

  async function toggleFulfilled(order: Order) {
    const { data } = await api.put(`/admin/orders/${order._id}/fulfill`, { fulfilled: !order.fulfilled });
    setOrders((prev) => prev.map((item) => (item._id === order._id ? data.order : item)));
  }

  async function exportCsv() {
    setExporting(true);
    try {
      // Auth-gated endpoint: fetch as a blob through `api` (carries the bearer
      // token) rather than a plain link, then trigger a client-side download.
      const { data } = await api.get(`/admin/orders.csv?${filterQuery(status, unshippedOnly)}`, {
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
        <button className="btn-icon" type="button" disabled={exporting} onClick={exportCsv}>
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {error && <p className="text-sm text-slate-400">{error}</p>}
      <div className="space-y-3">
        {!error && orders.length === 0 && <p className="text-sm text-slate-400">No orders found.</p>}
        {orders.map((order) => (
          <div key={order._id} className="admin-row" style={{ alignItems: 'flex-start' }}>
            <div className="min-w-0">
              <p className="font-bold text-white">
                {order.items.map((i) => `${i.name} ×${i.qty}`).join(', ')} · ${order.amount.toFixed(2)}
              </p>
              <p className="text-sm text-slate-400">
                {order.customer.name} · {order.customer.phone}
                {order.telegramUsername && (
                  <>
                    {' · '}
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
              <p className="text-sm text-slate-400">{order.customer.address}</p>
              <p className="text-xs text-slate-500">
                {order.reference} · {order.createdAt ? new Date(order.createdAt).toLocaleString() : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={order.status === 'paid' ? 'status-on' : 'status-off'}>{order.status}</span>
              {order.status === 'paid' && (
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={order.fulfilled} onChange={() => toggleFulfilled(order)} />
                  {order.fulfilled ? 'Shipped' : 'Mark shipped'}
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
