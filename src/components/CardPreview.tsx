import { useEffect, useState } from 'react';
import type { CardDesign } from '../lib/types';
import { getTemplate } from './cardTemplates';

// Renders the front + back of the user's chosen card template. The QR (encoding
// their profile URL) is generated here and handed to the template. Template
// styles live in cardTemplates.tsx — this component just dispatches.
export function CardPreview({ design }: { design: CardDesign }) {
  const [qr, setQr] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (design.profileUrl) {
      import('qrcode').then((QR) =>
        QR.default
          .toDataURL(design.profileUrl, { width: 240, margin: 0 })
          .then((url) => {
            if (!cancelled) setQr(url);
          })
          .catch(() => {}),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [design.profileUrl]);

  const tpl = getTemplate(design.template);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Front</p>
        <tpl.Front design={design} qr={qr} />
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Back</p>
        <tpl.Back design={design} qr={qr} />
      </div>
    </div>
  );
}
