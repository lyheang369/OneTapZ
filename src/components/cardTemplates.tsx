/* eslint-disable react-refresh/only-export-components -- registry module: exports the
   template list + lookup alongside the face components by design (not HMR-sensitive). */
import type { CSSProperties, ReactElement } from 'react';
import { Mail, Phone, Send } from 'lucide-react';
import type { CardDesign } from '../lib/types';

// Code-built name-card styles. Each template renders a Front + Back face from the
// shared CardDesign data + a QR data URL. Faces are CSS containers sized in `cqw`
// (1cqw = 1% of card width) so every style scales identically at any width.
const INK = '#0b0b0b';
const DISPLAY = "'CardDisplay', system-ui, 'Arial Black', sans-serif";

export type FaceProps = { design: CardDesign; qr: string };
type Face = (props: FaceProps) => ReactElement;
export type CardTemplate = { id: string; label: string; Front: Face; Back: Face };

const baseFace: CSSProperties = {
  containerType: 'inline-size',
  aspectRatio: '1063 / 709',
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '3cqw',
  fontFamily: DISPLAY,
};

// Extruded 3D headline (Acid Pop): colored fill, outline, hard offset shadow.
function headline(color: string, sizeCqw: number, stroke = INK): CSSProperties {
  return {
    color,
    fontFamily: DISPLAY,
    WebkitTextStroke: `0.5cqw ${stroke}`,
    textShadow: `1cqw 1cqw 0 ${stroke}`,
    fontWeight: 900,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase',
    lineHeight: 0.92,
    fontSize: `${sizeCqw}cqw`,
    margin: 0,
  };
}

const name = (d: CardDesign) => d.name || 'Your Name';

function Row({ icon, text, color, iconBg, iconColor }: { icon: ReactElement; text: string; color: string; iconBg: string; iconColor: string }) {
  if (!text) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2.2cqw', minWidth: 0 }}>
      <span style={{ flex: 'none', width: '6cqw', height: '6cqw', borderRadius: '50%', background: iconBg, color: iconColor, display: 'grid', placeItems: 'center' }}>
        {icon}
      </span>
      <span style={{ fontWeight: 800, fontSize: '3.2cqw', color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
    </div>
  );
}

// The three contact rows, themeable per template.
function Contacts({ design, color, iconBg, iconColor }: { design: CardDesign; color: string; iconBg: string; iconColor: string }) {
  const ic = { width: '3.3cqw', height: '3.3cqw' } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5cqw', minWidth: 0 }}>
      <Row icon={<Send style={ic} />} text={design.handle ? `@${design.handle}` : ''} color={color} iconBg={iconBg} iconColor={iconColor} />
      <Row icon={<Phone style={ic} />} text={design.phone} color={color} iconBg={iconBg} iconColor={iconColor} />
      <Row icon={<Mail style={ic} />} text={design.email} color={color} iconBg={iconBg} iconColor={iconColor} />
    </div>
  );
}

const Qr = ({ qr, design, size = 22 }: { qr: string; design: CardDesign; size?: number }) =>
  design.profileUrl && qr ? <img src={qr} alt="" style={{ width: `${size}cqw`, height: `${size}cqw`, flex: 'none' }} /> : null;

export const CARD_TEMPLATES: CardTemplate[] = [
  // Acid Pop — the PSD artwork front + chunky 3D text.
  {
    id: 'acid-pop',
    label: 'Acid Pop',
    Front: ({ design }) => (
      <div style={{ ...baseFace, border: `0.4cqw solid ${INK}`, backgroundImage: "url('/card/front.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <h3 style={{ ...headline('#16d06a', 14), position: 'absolute', left: '7%', bottom: '8%', maxWidth: '58%' }}>{name(design)}</h3>
      </div>
    ),
    Back: ({ design, qr }) => (
      <div style={{ ...baseFace, border: `0.4cqw solid ${INK}`, background: '#fff', color: INK }}>
        <div style={{ position: 'absolute', inset: 0, padding: '6cqw', display: 'flex', flexDirection: 'column' }}>
          <h3 style={headline('#f6a8cd', 9.5)}>{name(design)}</h3>
          {design.tagline && <p style={{ marginTop: '2cqw', fontWeight: 800, fontSize: '4cqw' }}>{design.tagline}</p>}
          <div style={{ height: '0.4cqw', background: INK, margin: '3cqw 0', opacity: 0.85 }} />
          <div style={{ display: 'flex', gap: '4cqw', alignItems: 'center' }}>
            <Qr qr={qr} design={design} />
            <Contacts design={design} color={INK} iconBg={INK} iconColor="#fff" />
          </div>
        </div>
      </div>
    ),
  },

  // Minimal — clean black-on-white, thin rules, plenty of space.
  {
    id: 'mono',
    label: 'Minimal',
    Front: ({ design }) => (
      <div style={{ ...baseFace, border: `0.3cqw solid ${INK}`, background: '#fff', color: INK }}>
        <div style={{ position: 'absolute', inset: 0, padding: '9cqw', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ width: '11cqw', height: '1cqw', background: INK, marginBottom: '5cqw' }} />
          <h3 style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 900, fontSize: '12cqw', lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>{name(design)}</h3>
          {design.tagline && <p style={{ margin: '3cqw 0 0', fontSize: '3.4cqw', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#666' }}>{design.tagline}</p>}
        </div>
      </div>
    ),
    Back: ({ design, qr }) => (
      <div style={{ ...baseFace, border: `0.3cqw solid ${INK}`, background: '#fff', color: INK }}>
        <div style={{ position: 'absolute', inset: 0, padding: '7cqw', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: 0, fontWeight: 900, fontSize: '7cqw', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>{name(design)}</h3>
          {design.tagline && <p style={{ margin: '1.5cqw 0 0', fontSize: '3.4cqw', color: '#666' }}>{design.tagline}</p>}
          <div style={{ height: '0.2cqw', background: INK, margin: '4cqw 0' }} />
          <div style={{ display: 'flex', gap: '4cqw', alignItems: 'center' }}>
            <Qr qr={qr} design={design} />
            <Contacts design={design} color={INK} iconBg={INK} iconColor="#fff" />
          </div>
        </div>
      </div>
    ),
  },
];

export function getTemplate(id: string): CardTemplate {
  return CARD_TEMPLATES.find((t) => t.id === id) ?? CARD_TEMPLATES[0];
}
