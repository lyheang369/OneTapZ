import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  Link2,
  MessageCircle,
  QrCode,
  ShoppingBag,
  Sparkles,
  Wifi,
} from 'lucide-react';

const profileTypes = ['Student portfolio', 'Creator media kit', 'Freelance contact page', 'Campus club profile'];

const services = [
  { icon: Link2, title: 'Links', text: 'Publish socials, portfolio, booking, store, and contact links.' },
  { icon: CreditCard, title: 'NFC card', text: 'Connect one physical card to your current profile URL.' },
  { icon: QrCode, title: 'QR sharing', text: 'Download a QR code for events, posters, and introductions.' },
  { icon: BarChart3, title: 'Analytics', text: 'See profile views, link clicks, total taps, and top links.' },
];

const workflow = [
  'Choose a username',
  'Add links and contact buttons',
  'Connect an NFC card',
  'Share your profile anywhere',
];

const useCases = [
  { icon: CalendarDays, title: 'Events', text: 'Share one page after a talk, meetup, class fair, or portfolio review.' },
  { icon: MessageCircle, title: 'Contact', text: 'Let people tap once to email, call, message, or open your socials.' },
  { icon: ShoppingBag, title: 'Work', text: 'Point clients to your services, portfolio, bookings, and payment links.' },
];

export function Home() {
  return (
    <main className="site-page">
      <section className="lynk-hero">
        <div className="page-shell lynk-hero-grid">
          <div className="lynk-hero-copy">
            <p className="eyebrow">Digital profile + NFC card</p>
            <h1 className="hero-title">One profile for every tap.</h1>
            <p className="hero-text">
              Build a mobile-first profile for links, socials, contact details, portfolio work, QR codes,
              and NFC card sharing.
            </p>

            <div className="claim-box" aria-label="Create profile URL">
              <span>onetapz.me/</span>
              <input aria-label="Username" placeholder="yourname" />
              <Link to="/register">
                Create
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="profile-type-row" aria-label="Profile types">
              {profileTypes.map((type) => (
                <span key={type}>{type}</span>
              ))}
            </div>
          </div>

          <div className="mockup-stage" aria-label="OneTapZ mobile profile preview">
            <div className="floating-card floating-card-left">
              <Sparkles size={18} />
              <span>Tap shared</span>
            </div>
            <div className="mobile-stack back">
              <div className="mini-avatar" />
              <span>onetapz.me/creator</span>
              <strong>Portfolio</strong>
              <strong>Instagram</strong>
              <strong>Email</strong>
            </div>
            <div className="mobile-stack front">
              <div className="phone-notch" />
              <div className="profile-avatar" />
              <h2>Your Name</h2>
              <p>Links, contact, QR, and NFC sharing in one page.</p>
              <a>Portfolio</a>
              <a>Book a call</a>
              <a>Contact</a>
            </div>
            <div className="floating-card floating-card-right">
              <QrCode size={18} />
              <span>QR ready</span>
            </div>
          </div>
        </div>
      </section>

      <section className="creator-strip">
        <div className="page-shell creator-strip-inner">
          <span>Built for</span>
          <strong>students</strong>
          <strong>creators</strong>
          <strong>freelancers</strong>
          <strong>young professionals</strong>
        </div>
      </section>

      <section className="lynk-section" id="how-it-works">
        <div className="page-shell">
          <div className="lynk-section-heading">
            <p className="eyebrow">Workflow</p>
            <h2>Start with a link. Share with a tap.</h2>
          </div>
          <div className="workflow-row">
            {workflow.map((item, index) => (
              <article key={item} className="workflow-card">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{item}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lynk-section muted">
        <div className="page-shell">
          <div className="lynk-section-heading">
            <p className="eyebrow">What you can add</p>
            <h2>Not just another link page.</h2>
          </div>
          <div className="service-grid">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className="service-card">
                  <Icon size={24} />
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lynk-section">
        <div className="page-shell split-feature">
          <div>
            <p className="eyebrow">NFC card</p>
            <h2>One card. One profile. Update anytime.</h2>
            <p>
              Your NFC card points to your OneTapZ profile URL. Update the profile from your dashboard
              without reprinting the card.
            </p>
            <Link className="btn-primary" to="/register">
              Sign up
            </Link>
          </div>
          <div className="nfc-showcase-card">
            <Wifi size={28} />
            <span>OneTapZ</span>
            <small>onetapz.me/yourname</small>
          </div>
        </div>
      </section>

      <section className="lynk-section muted">
        <div className="page-shell">
          <div className="lynk-section-heading">
            <p className="eyebrow">Use cases</p>
            <h2>Useful when introductions need to move fast.</h2>
          </div>
          <div className="use-case-grid">
            {useCases.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="use-case-card">
                  <Icon size={24} />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="page-shell final-cta-inner">
          <h2>Create your OneTapZ profile.</h2>
          <Link className="btn-primary" to="/register">
            Get started
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
