import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CreditCard, Link2, QrCode, ShieldCheck, Wifi } from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Create a profile',
    text: 'Add your name, bio, profile image, contact buttons, and public username.',
  },
  {
    number: '02',
    title: 'Add destinations',
    text: 'Publish social links, portfolio pages, booking links, email, and custom buttons.',
  },
  {
    number: '03',
    title: 'Share by tap or scan',
    text: 'Connect an NFC card, download a QR code, or copy your OneTapZ public link.',
  },
];

const features = [
  { icon: Link2, title: 'Link management', text: 'Add, edit, reorder, disable, and track profile links.' },
  { icon: Wifi, title: 'NFC cards', text: 'Assign a card ID to a user profile and control card status.' },
  { icon: QrCode, title: 'QR code', text: 'Generate a QR code for the public profile and download it as an image.' },
  { icon: BarChart3, title: 'Analytics', text: 'Track profile views, link clicks, total taps, and top-performing links.' },
];

const faqs = [
  {
    question: 'Can I update my profile after printing an NFC card?',
    answer: 'Yes. The card points to your OneTapZ profile URL, so profile content can change anytime.',
  },
  {
    question: 'Does someone need an app to open my profile?',
    answer: 'No. A tap, scan, or link opens the public profile page in a browser.',
  },
  {
    question: 'Can admins assign card IDs?',
    answer: 'Yes. The admin panel includes user management, NFC card records, and status controls.',
  },
];

export function Home() {
  return (
    <main className="site-page">
      <section className="hero-section">
        <div className="page-shell site-grid min-h-[calc(100svh-64px)]">
          <div className="hero-copy">
            <p className="eyebrow">NFC profile platform</p>
            <h1 className="hero-title">One Tap. All Your Links.</h1>
            <p className="hero-text">
              OneTapZ gives students, creators, freelancers, and young professionals one public profile
              for links, contact details, portfolio work, QR sharing, and NFC card taps.
            </p>
            <div className="hero-actions">
              <Link className="btn-primary" to="/register">
                Create profile
                <ArrowRight size={18} />
              </Link>
              <a className="btn-ghost" href="#how-it-works">
                How it works
              </a>
            </div>
          </div>

          <div className="profile-spec" aria-label="OneTapZ profile structure">
            <div className="spec-row spec-row-head">
              <span>Public URL</span>
              <strong>onetapz.link/username</strong>
            </div>
            <div className="spec-block">
              <span className="spec-label">Profile includes</span>
              <div className="spec-list">
                <span>Photo</span>
                <span>Name</span>
                <span>Bio</span>
                <span>Social links</span>
                <span>Contact buttons</span>
                <span>QR code</span>
              </div>
            </div>
            <div className="spec-matrix">
              <div>
                <QrCode size={30} />
                <span>Scan</span>
              </div>
              <div>
                <CreditCard size={30} />
                <span>Tap</span>
              </div>
              <div>
                <Link2 size={30} />
                <span>Share</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-band">
        <div className="page-shell">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2 className="section-title">Three steps from setup to share.</h2>
          </div>
          <div className="swiss-columns">
            {steps.map((step) => (
              <article key={step.number} className="panel">
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-band">
        <div className="page-shell">
          <div className="section-heading">
            <p className="eyebrow">Features</p>
            <h2 className="section-title">The MVP surface is focused and usable.</h2>
          </div>
          <div className="feature-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="panel">
                  <Icon size={24} />
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-band">
        <div className="page-shell site-grid compact">
          <div>
            <p className="eyebrow">NFC card</p>
            <h2 className="section-title">One card points to one profile link.</h2>
            <p className="section-text">
              The card can stay the same while the profile changes. Users update links in the dashboard;
              the NFC destination remains their public OneTapZ URL.
            </p>
          </div>
          <div className="nfc-card">
            <span>OneTapZ</span>
            <small>onetapz.link/username</small>
          </div>
        </div>
      </section>

      <section className="section-band">
        <div className="page-shell">
          <div className="section-heading">
            <p className="eyebrow">FAQ</p>
            <h2 className="section-title">Common setup questions.</h2>
          </div>
          <div className="faq-grid">
            {faqs.map((item) => (
              <article key={item.question} className="panel">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell py-14">
        <div className="cta-band">
          <ShieldCheck size={28} />
          <h2>Build your OneTapZ profile.</h2>
          <Link className="btn-primary" to="/register">
            Sign up
          </Link>
        </div>
      </section>
    </main>
  );
}
