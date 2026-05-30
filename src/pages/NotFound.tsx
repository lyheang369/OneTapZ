import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <main className="page-shell grid min-h-[70svh] place-items-center text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="section-title">Page not found</h1>
        <Link className="btn-primary mt-6" to="/">
          Go home
        </Link>
      </div>
    </main>
  );
}
