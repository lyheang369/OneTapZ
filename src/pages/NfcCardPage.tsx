import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Download, QrCode, ShoppingBag, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api, hasApiSession, publicProfileUrl } from '../lib/api';
import type { NfcCard } from '../lib/types';

type Product = { id: string; name: string; price: number };

export function NfcCardPage() {
  const { user } = useAuth();
  const [cardId, setCardId] = useState('');
  const [card, setCard] = useState<NfcCard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const profileUrl = useMemo(() => publicProfileUrl(user?.username || ''), [user?.username]);

  useEffect(() => {
    if (!hasApiSession()) return;
    api
      .get('/nfc/me')
      .then(({ data }) => {
        if (data.card) {
          setCard(data.card);
          setCardId(data.card.cardId);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/shop/products').then(({ data }) => setProducts(data.products ?? [])).catch(() => {});
  }, []);

  async function assignCard(event: FormEvent) {
    event.preventDefault();
    if (!cardId.trim()) return;

    if (hasApiSession()) {
      const { data } = await api.post('/nfc/assign', { cardId });
      setCard(data.card);
    } else {
      setCard({ _id: 'local', cardId, profileUrl, isActive: true });
    }
  }

  async function downloadQr() {
    const dataUrl = await QRCode.toDataURL(profileUrl, { width: 900, margin: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'onetapz-qr.png';
    a.click();
  }

  return (
    <DashboardLayout title="NFC card">
      <div className="grid gap-6 lg:grid-cols-2">
        <form className="panel space-y-4 p-6" onSubmit={assignCard}>
          <CreditCard className="text-sky-300" />
          <h2 className="text-xl font-bold text-white">Connect card</h2>
          <label className="field-label">
            NFC card ID
            <input className="input" value={cardId} onChange={(event) => setCardId(event.target.value)} />
          </label>
          <button className="btn-primary" type="submit">
            Assign card
          </button>
        </form>
        <div className="panel space-y-4 p-6">
          <p className="eyebrow">Assigned card</p>
          {card ? (
            <>
              <div className="info-row">
                <span>Card ID</span>
                <strong>{card.cardId}</strong>
              </div>
              <div className="info-row">
                <span>Profile URL</span>
                <strong>{card.profileUrl || profileUrl}</strong>
              </div>
              <div className="info-row">
                <span>Status</span>
                <strong>{card.isActive ? 'active' : 'inactive'}</strong>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">No card connected yet. Enter a card ID and assign it to your profile.</p>
          )}
          <button className="btn-ghost" type="button" onClick={downloadQr}>
            <Download size={17} />
            Download QR
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <QrCode size={16} />
            QR points to {profileUrl}
          </div>
        </div>
      </div>

      {/* Buy a card — surfaces the shop here; checkout + customizer live in /shop. */}
      <div className="panel mt-6 p-6">
        <ShoppingBag className="text-acid" />
        <h2 className="mt-3 text-xl font-bold text-white">{card ? 'Order another card' : 'Get your NFC card'}</h2>
        <p className="mt-1 text-sm text-slate-400">
          Customize a card with your profile details and a QR to your page, then pay with KHQR.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {products.map((product) => (
            <div key={product.id} className="info-row">
              <span className="flex items-center gap-2">
                <Sparkles size={15} className="text-acid" />
                {product.name}
              </span>
              <strong>${product.price.toFixed(2)}</strong>
            </div>
          ))}
        </div>
        <Link className="btn-primary mt-5" to="/shop">
          <ShoppingBag size={17} />
          Customize &amp; order
        </Link>
      </div>
    </DashboardLayout>
  );
}
