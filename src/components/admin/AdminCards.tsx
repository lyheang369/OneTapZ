import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { NfcCard } from '../../lib/types';

export function AdminCards() {
  const [cards, setCards] = useState<NfcCard[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/nfc-cards')
      .then(({ data }) => setCards(data.cards ?? []))
      .catch(() => setError('Could not load cards.'));
  }, []);

  return (
    <section className="panel p-6">
      <h2 className="mb-4 text-xl font-bold text-white">NFC cards</h2>
      {error && <p className="text-sm text-slate-400">{error}</p>}
      <div className="space-y-3">
        {!error && cards.length === 0 && <p className="text-sm text-slate-400">No cards yet.</p>}
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
  );
}
