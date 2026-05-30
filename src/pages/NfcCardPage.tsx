import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CreditCard, Download, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { demoCard } from '../data/demo';
import { api, publicProfileUrl } from '../lib/api';
import type { NfcCard } from '../lib/types';

export function NfcCardPage() {
  const { user } = useAuth();
  const [cardId, setCardId] = useState(demoCard.cardId);
  const [card, setCard] = useState<NfcCard>(demoCard);
  const profileUrl = useMemo(() => publicProfileUrl(user?.username || 'zara'), [user?.username]);

  async function assignCard(event: FormEvent) {
    event.preventDefault();
    const next = { ...card, cardId, profileUrl, isActive: true };
    setCard(next);
    if (localStorage.getItem('onetapz_token') !== 'demo-token') {
      const { data } = await api.post('/nfc/assign', { cardId });
      setCard(data.card);
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
    </DashboardLayout>
  );
}
