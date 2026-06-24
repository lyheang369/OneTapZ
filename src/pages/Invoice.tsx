import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Clock, Loader2, Send } from 'lucide-react';
import { api } from '../lib/api';

type InvoiceOrder = {
  reference: string;
  items: { name: string; price: number; qty: number }[];
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'expired';
  fulfilled: boolean;
  customerName: string;
  createdAt?: string;
  paidAt?: string;
};

const BOT = import.meta.env.VITE_TELEGRAM_BOT_NAME as string | undefined;

export function Invoice() {
  const { reference = '' } = useParams();
  const [order, setOrder] = useState<InvoiceOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/shop/order/${reference}`)
      .then(({ data }) => setOrder(data.order))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [reference]);

  if (loading) {
    return (
      <main className="site-page">
        <div className="page-shell invoice-wrap text-slate-400">Loading invoice…</div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="site-page">
        <div className="page-shell invoice-wrap">
          <h1 className="hero-title">Order not found</h1>
          <p className="hero-text">We couldn't find an order with that reference.</p>
          <Link className="btn-primary mt-4" to="/shop">
            Back to shop
          </Link>
        </div>
      </main>
    );
  }

  const badge =
    order.status === 'paid'
      ? { cls: 'inv-paid', label: order.fulfilled ? 'Paid · Shipped' : 'Paid', Icon: Check }
      : order.status === 'expired'
        ? { cls: 'inv-expired', label: 'Expired', Icon: Clock }
        : { cls: 'inv-pending', label: 'Awaiting payment', Icon: Loader2 };

  return (
    <main className="site-page">
      <div className="page-shell invoice-wrap">
        <div className="invoice-card panel">
          <div className="invoice-head">
            <div>
              <p className="eyebrow">OneTapZ · Invoice</p>
              <h1 className="invoice-ref">{order.reference}</h1>
            </div>
            <span className={`invoice-badge ${badge.cls}`}>
              <badge.Icon size={14} className={order.status === 'pending' ? 'animate-spin' : ''} />
              {badge.label}
            </span>
          </div>

          <div className="invoice-lines">
            {order.items.map((i) => (
              <div key={i.name} className="invoice-line">
                <span>
                  {i.name} <span className="invoice-qty">× {i.qty}</span>
                </span>
                <span>${(i.price * i.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="invoice-line total">
              <span>Total</span>
              <span>
                ${order.amount.toFixed(2)} {order.currency}
              </span>
            </div>
          </div>

          <div className="invoice-meta">
            {order.customerName && <p>Name: {order.customerName}</p>}
            {order.createdAt && <p>Ordered: {new Date(order.createdAt).toLocaleString()}</p>}
            {order.paidAt && <p>Paid: {new Date(order.paidAt).toLocaleString()}</p>}
          </div>

          {order.status === 'paid' ? (
            <p className="invoice-note ok">Payment received — we'll arrange delivery with you.</p>
          ) : order.status === 'expired' ? (
            <p className="invoice-note bad">This payment window expired. Place the order again from the shop.</p>
          ) : (
            <p className="invoice-note">This order is awaiting payment.</p>
          )}

          <div className="invoice-actions">
            {BOT && (
              <a className="btn-ghost" href={`https://t.me/${BOT.replace('@', '')}`} target="_blank" rel="noreferrer">
                <Send size={16} />
                Get updates on Telegram
              </a>
            )}
            <Link className="btn-primary" to="/shop">
              Back to shop
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
