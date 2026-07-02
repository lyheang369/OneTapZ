import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, ExternalLink, Loader2, Minus, Plus } from 'lucide-react';
import { CardPreview } from '../components/CardPreview';
import { getTemplate } from '../components/cardTemplates';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { CardDesign } from '../lib/types';

type Product = { id: string; name: string; description: string; price: number; discountPrice: number; effectivePrice: number };
type CheckoutResult = { reference: string; amount: number; qrCode: string; paymentUrl?: string };

const STEPS = [
  { id: 'design', label: 'Design' },
  { id: 'customize', label: 'Customize' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'payment', label: 'Payment' },
] as const;
type Step = (typeof STEPS)[number]['id'];

// Provincial couriers offered for delivery; Phnom Penh ships direct.
const COURIERS = ['VET', 'J&T', 'ZTO', 'L192 Express'] as const;
const DELIVERY_FEE = 1.5; // mirrors server DELIVERY_FEE; server recomputes the authoritative amount
const PICKUP_ADDRESS =
  'CamTech campus — CamTech Street, Chroy Chongvar Satellite City, Sangkat Prektasek, Khan Chroy Chongvar, Phnom Penh, Cambodia';
type Delivery = { method: 'pickup' | 'delivery'; area: 'phnom-penh' | 'province'; courier: string; address: string };

export function Shop() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  // Single-selection: the buyer picks one card design (= one product) + a quantity.
  const [selectedId, setSelectedId] = useState('');
  const [count, setCount] = useState(1);
  const [step, setStep] = useState<Step>('design');

  // Card customization, derived from the user's profile with an edits overlay so
  // typing overrides the prefill (and clearing a field keeps it empty). Deriving
  // — rather than copying into state via an effect — reacts to the async auth
  // load and sidesteps the react-hooks/set-state-in-effect rule.
  const [cardEdits, setCardEdits] = useState<Partial<CardDesign>>({});
  const card: CardDesign = {
    template: selectedId || 'acid-pop',
    name: cardEdits.name ?? user?.name ?? '',
    tagline: cardEdits.tagline ?? user?.bio ?? '',
    handle: cardEdits.handle ?? user?.username ?? '',
    phone: cardEdits.phone ?? user?.phone ?? '',
    email: cardEdits.email ?? user?.contactEmail ?? '',
    profileUrl: cardEdits.profileUrl ?? (user?.username ? `${window.location.origin}/${user.username}` : ''),
  };
  const setCardField = (key: keyof CardDesign, value: string) => setCardEdits((prev) => ({ ...prev, [key]: value }));

  // Inline style for the delivery-option cards, mirroring the KHQR method card.
  const optStyle = (active: boolean) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.85rem 1rem',
    borderRadius: '0.9rem',
    cursor: 'pointer',
    border: `2px solid ${active ? 'var(--acid)' : 'rgba(255,255,255,0.12)'}`,
    background: active ? 'rgba(204,255,0,0.06)' : 'transparent',
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [delivery, setDelivery] = useState<Delivery>({ method: 'pickup', area: 'phnom-penh', courier: COURIERS[0], address: '' });

  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [qr, setQr] = useState('');
  const [status, setStatus] = useState<'pending' | 'paid' | 'expired'>('pending');
  const [secondsLeft, setSecondsLeft] = useState(300);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    api
      .get('/shop/products')
      .then(({ data }) => {
        const list: Product[] = data.products ?? [];
        setProducts(list);
        if (list.length) setSelectedId((cur) => cur || list[0].id);
      })
      .catch(() => {});
  }, []);

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);
  const itemsTotal = selectedProduct ? selectedProduct.effectivePrice * count : 0;
  const deliveryFee = delivery.method === 'delivery' ? DELIVERY_FEE : 0;
  const total = Math.round((itemsTotal + deliveryFee) * 100) / 100;
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  // Render the KHQR string to an image (high error-correction so the centered
  // Bakong logo doesn't break scanning) and poll for payment once we have a ref.
  useEffect(() => {
    if (!checkout) return;
    let cancelled = false;
    import('qrcode').then((QR) => {
      QR.default.toDataURL(checkout.qrCode, { width: 360, margin: 1, errorCorrectionLevel: 'H' }).then((url) => {
        if (!cancelled) setQr(url);
      });
    });

    const deadline = Date.now() + 5 * 60 * 1000;
    const tick = window.setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setStatus((s) => (s === 'pending' ? 'expired' : s));
    }, 1000);

    pollRef.current = window.setInterval(async () => {
      try {
        const { data } = await api.get('/shop/status', { params: { reference: checkout.reference } });
        if (data.status === 'paid' || data.status === 'expired') {
          setStatus(data.status);
          if (pollRef.current) window.clearInterval(pollRef.current);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [checkout]);

  async function pay() {
    setError('');
    if (!selectedProduct || count < 1) return setError('Pick a card design to continue.');
    if (delivery.method === 'delivery' && !delivery.address.trim()) return setError('Enter your delivery address.');
    setSubmitting(true);
    try {
      // Logged-in session is sent via the api Authorization header; the server
      // resolves the buyer's name + Telegram from their account.
      const { data } = await api.post('/shop/checkout', {
        items: [{ productId: selectedProduct.id, qty: count }],
        cardDesign: card,
        delivery,
      });
      setStatus('pending');
      setSecondsLeft(300);
      setCheckout(data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not start checkout. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setCheckout(null);
    setQr('');
    setStatus('pending');
    setStep('design');
  }

  return (
    <main className="site-page">
      <section className="shop-wrap page-shell">
        <p className="eyebrow">OneTapZ Shop</p>
        <h1 className="hero-title">Get your NFC card.</h1>
        <p className="hero-text">Tap to share your whole OneTapZ profile. Pay securely with KHQR — any Bakong app.</p>

        {!user ? (
          /* Shop requires an account — no anonymous cart. */
          <div className="panel shop-checkout p-6 text-center">
            <h2 className="text-xl font-bold text-white">Log in to order</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Sign in to your OneTapZ account to design and order your NFC card — your profile details prefill the card automatically.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link className="btn-primary justify-center" to="/login">
                Log in
              </Link>
              <Link className="btn-ghost justify-center" to="/register">
                Create account
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Step indicator */}
            <div className="mb-6 flex flex-wrap gap-2">
              {STEPS.map((s, i) => {
                const state = i === stepIndex ? 'active' : i < stepIndex ? 'done' : 'todo';
                return (
                  <span
                    key={s.id}
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '0.35rem 0.8rem',
                      borderRadius: '999px',
                      border: '1px solid',
                      borderColor: state === 'todo' ? 'rgba(255,255,255,0.15)' : 'var(--acid)',
                      background: state === 'active' ? 'var(--acid)' : 'transparent',
                      color: state === 'active' ? '#0a0a0a' : state === 'done' ? 'var(--acid)' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {i + 1}. {s.label}
                  </span>
                );
              })}
            </div>

            {/* Step 1 — choose a design */}
            {step === 'design' && (
              <>
                <p className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Choose your design</p>
                <div className="shop-grid">
                  {products.map((product) => {
                    const selected = selectedId === product.id;
                    const Front = getTemplate(product.id).Front;
                    const discounted = product.effectivePrice < product.price;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setSelectedId(product.id)}
                        className="shop-card panel"
                        style={{ position: 'relative', textAlign: 'left', cursor: 'pointer', border: selected ? '2px solid var(--acid)' : undefined }}
                        aria-pressed={selected}
                      >
                        {selected && (
                          <span style={{ position: 'absolute', top: '0.9rem', right: '0.9rem', zIndex: 2, background: 'var(--acid)', color: '#0a0a0a', borderRadius: '999px', width: '1.7rem', height: '1.7rem', display: 'grid', placeItems: 'center' }}>
                            <Check size={15} />
                          </span>
                        )}
                        <Front design={{ ...card, template: product.id }} qr="" />
                        <div className="shop-card-foot" style={{ marginTop: '0.9rem' }}>
                          <h3 style={{ margin: 0 }}>{product.name}</h3>
                          <span className="shop-price">
                            {discounted && (
                              <span style={{ textDecoration: 'line-through', opacity: 0.5, fontWeight: 600, marginRight: '0.45em', fontSize: '0.7em' }}>
                                ${product.price.toFixed(2)}
                              </span>
                            )}
                            ${product.effectivePrice.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button className="btn-primary mt-6 w-full justify-center" type="button" onClick={() => selectedProduct && setStep('customize')} disabled={!selectedProduct}>
                  Continue
                </button>
              </>
            )}

            {/* Step 2 — customize the chosen design */}
            {step === 'customize' && (
              <div className="panel shop-checkout p-6">
                <h2 className="text-xl font-bold text-white">Customize your card</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Live preview of your <strong>{selectedProduct?.name}</strong> design — prefilled from your profile. Edit any field; the QR links to your OneTapZ profile.
                </p>
                <div className="mt-4">
                  <CardPreview design={card} />
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="field-label">
                    Name
                    <input className="input" value={card.name} onChange={(e) => setCardField('name', e.target.value)} />
                  </label>
                  <label className="field-label">
                    Tagline
                    <input className="input" value={card.tagline} onChange={(e) => setCardField('tagline', e.target.value)} />
                  </label>
                  <label className="field-label">
                    Telegram handle
                    <input className="input" value={card.handle} onChange={(e) => setCardField('handle', e.target.value)} placeholder="username" />
                  </label>
                  <label className="field-label">
                    Phone
                    <input className="input" value={card.phone} onChange={(e) => setCardField('phone', e.target.value)} />
                  </label>
                  <label className="field-label">
                    Email
                    <input className="input" value={card.email} onChange={(e) => setCardField('email', e.target.value)} />
                  </label>
                  <label className="field-label">
                    Profile URL (QR)
                    <input className="input" value={card.profileUrl} onChange={(e) => setCardField('profileUrl', e.target.value)} placeholder="https://onetapz.me/you" />
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="btn-text" type="button" onClick={() => setStep('design')}>
                    Back
                  </button>
                  <button className="btn-primary flex-1 justify-center" type="button" onClick={() => setStep('delivery')}>
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — pickup or delivery */}
            {step === 'delivery' && (
              <div className="panel shop-checkout p-6">
                <h2 className="text-xl font-bold text-white">Delivery</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Customization &amp; printing takes <strong className="text-white">3–5 working days</strong> before your card is ready.
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  <label style={optStyle(delivery.method === 'pickup')}>
                    <input
                      type="radio"
                      name="delivery-method"
                      className="mt-1"
                      checked={delivery.method === 'pickup'}
                      onChange={() => setDelivery((d) => ({ ...d, method: 'pickup' }))}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-bold text-white">Pickup — free</p>
                      <p className="text-sm text-slate-400">{PICKUP_ADDRESS}</p>
                    </div>
                  </label>
                  <label style={optStyle(delivery.method === 'delivery')}>
                    <input
                      type="radio"
                      name="delivery-method"
                      className="mt-1"
                      checked={delivery.method === 'delivery'}
                      onChange={() => setDelivery((d) => ({ ...d, method: 'delivery' }))}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-bold text-white">Delivery — ${DELIVERY_FEE.toFixed(2)}</p>
                      <p className="text-sm text-slate-400">Phnom Penh, or provinces via VET / J&amp;T / ZTO / L192 Express</p>
                    </div>
                  </label>
                </div>

                {delivery.method === 'delivery' && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`${delivery.area === 'phnom-penh' ? 'btn-primary' : 'btn-text'} flex-1 justify-center`}
                        onClick={() => setDelivery((d) => ({ ...d, area: 'phnom-penh' }))}
                      >
                        Phnom Penh
                      </button>
                      <button
                        type="button"
                        className={`${delivery.area === 'province' ? 'btn-primary' : 'btn-text'} flex-1 justify-center`}
                        onClick={() => setDelivery((d) => ({ ...d, area: 'province' }))}
                      >
                        Provinces
                      </button>
                    </div>
                    {delivery.area === 'province' && (
                      <label className="field-label">
                        Courier
                        <select
                          className="input"
                          value={delivery.courier}
                          onChange={(e) => setDelivery((d) => ({ ...d, courier: e.target.value }))}
                        >
                          {COURIERS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="field-label">
                      Delivery address
                      <textarea
                        className="input"
                        rows={2}
                        value={delivery.address}
                        placeholder="House #, street, sangkat / khan, city / province"
                        onChange={(e) => setDelivery((d) => ({ ...d, address: e.target.value }))}
                      />
                    </label>
                  </div>
                )}

                {error && <p className="alert mt-3">{error}</p>}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="btn-text" type="button" onClick={() => setStep('customize')}>
                    Back
                  </button>
                  <button
                    className="btn-primary flex-1 justify-center"
                    type="button"
                    onClick={() => {
                      if (delivery.method === 'delivery' && !delivery.address.trim()) {
                        setError('Enter your delivery address.');
                        return;
                      }
                      setError('');
                      setStep('payment');
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 4 — payment method + pay */}
            {step === 'payment' && (
              <div className="panel shop-checkout p-6">
                <h2 className="text-xl font-bold text-white">Payment</h2>

                <div className="shop-summary mt-4">
                  <div className="shop-summary-row">
                    <span>Quantity</span>
                    <div className="qty-stepper">
                      <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="Decrease quantity">
                        <Minus size={15} />
                      </button>
                      <span>{count}</span>
                      <button type="button" onClick={() => setCount((c) => Math.min(99, c + 1))} aria-label="Increase quantity">
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                  {selectedProduct && (
                    <div className="shop-summary-row">
                      <span>
                        {selectedProduct.name} × {count}
                      </span>
                      <span>${(selectedProduct.effectivePrice * count).toFixed(2)}</span>
                    </div>
                  )}
                  {card.name && (
                    <div className="shop-summary-row">
                      <span>Name on card</span>
                      <span className="truncate">{card.name}</span>
                    </div>
                  )}
                  {card.handle && (
                    <div className="shop-summary-row">
                      <span>Handle</span>
                      <span className="truncate">@{card.handle}</span>
                    </div>
                  )}
                  <div className="shop-summary-row">
                    <span>Delivery</span>
                    <span className="truncate">
                      {delivery.method === 'pickup'
                        ? 'Pickup — free'
                        : `${delivery.area === 'province' ? `Province · ${delivery.courier}` : 'Phnom Penh'} · $${deliveryFee.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="shop-summary-row total">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                <p className="field-label mt-5">Payment method</p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.9rem',
                    padding: '0.9rem 1rem',
                    borderRadius: '0.9rem',
                    border: '2px solid var(--acid)',
                    background: 'rgba(204,255,0,0.06)',
                  }}
                >
                  <img src="/bakong-icon.png" alt="" style={{ width: 40, height: 40, borderRadius: 8, flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="font-bold text-white">KHQR</p>
                    <p className="text-sm text-slate-400">Bakong — scan with any banking app</p>
                  </div>
                  <span style={{ flex: 'none', background: 'var(--acid)', color: '#0a0a0a', borderRadius: '999px', width: '1.6rem', height: '1.6rem', display: 'grid', placeItems: 'center' }}>
                    <Check size={14} />
                  </span>
                </div>

                {error && <p className="alert mt-3">{error}</p>}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="btn-text" type="button" onClick={() => setStep('delivery')}>
                    Back
                  </button>
                  <button className="btn-primary flex-1 justify-center" type="button" onClick={pay} disabled={submitting}>
                    {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                    Pay · ${total.toFixed(2)}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {checkout && (
        <div className="khqr-overlay" role="dialog" aria-modal="true" onClick={status !== 'pending' ? reset : undefined}>
          {status === 'paid' ? (
            <div className="khqr-card khqr-state" onClick={(e) => e.stopPropagation()}>
              <div className="khqr-state-badge ok">
                <Check size={34} />
              </div>
              <h2>Payment received</h2>
              <p>Thank you! Your order is confirmed — view your invoice or check Telegram for details.</p>
              <Link className="btn-primary" to={`/order/${checkout.reference}`}>
                View invoice
              </Link>
              <button className="khqr-cancel" type="button" onClick={reset}>
                Back to shop
              </button>
            </div>
          ) : status === 'expired' ? (
            <div className="khqr-card khqr-state" onClick={(e) => e.stopPropagation()}>
              <div className="khqr-state-badge expired">
                <Clock size={32} />
              </div>
              <h2>QR expired</h2>
              <p>The payment window timed out. Please try again.</p>
              <button className="btn-primary" type="button" onClick={reset}>
                Back to shop
              </button>
            </div>
          ) : (
            <div className="khqr-pay" onClick={(e) => e.stopPropagation()}>
              <div className="khqr-pay-head">
                <span className="khqr-logo-badge">KHQR</span>
                <span className="khqr-pay-label">PAYMENT</span>
              </div>
              <div className="khqr-pay-body">
                <p className="khqr-merchant">OneTapZ</p>
                <p className="khqr-amount2">
                  <strong>{checkout.amount.toFixed(2)}</strong> <span>USD</span>
                </p>
                <div className="khqr-dash" />
                <div className="khqr-qr-wrap">
                  {qr ? <img className="khqr-qr-img" src={qr} alt="KHQR payment code" /> : <div className="khqr-qr-img skeleton-box" />}
                  <img className="khqr-qr-logo" src="/bakong-icon.png" alt="" />
                </div>
                <p className="khqr-expiry">
                  <Clock size={14} /> Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </p>
                <p className="khqr-waiting2">
                  <Loader2 className="animate-spin" size={14} /> Waiting for payment…
                </p>
                {checkout.paymentUrl && (
                  <a className="khqr-browser" href={checkout.paymentUrl} target="_blank" rel="noreferrer">
                    Pay in browser <ExternalLink size={13} />
                  </a>
                )}
              </div>
              <div className="khqr-steps">
                <p className="khqr-tagline">Scan. Pay. Done.</p>
                <ol>
                  <li>
                    <span>1</span> Open Bakong or any banking app that supports KHQR
                  </li>
                  <li>
                    <span>2</span> Scan the QR code
                  </li>
                  <li>
                    <span>3</span> Confirm and done
                  </li>
                </ol>
              </div>
              <div className="khqr-pay-foot">Secured by KHQR · Powered by Bakong</div>
              <button className="khqr-cancel" type="button" onClick={reset}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
