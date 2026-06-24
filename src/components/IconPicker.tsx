import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { IconBadge } from './IconBadge';
import { iconOptions } from '../lib/icons';

export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? iconOptions.filter((name) => name.includes(q)) : iconOptions;
  }, [query]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function select(name: string) {
    onChange(name);
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <button type="button" className="icon-picker-trigger" onClick={() => setOpen(true)}>
        <IconBadge name={value} />
        <span className="flex-1 text-left">{value}</span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="icon-modal-overlay" role="dialog" aria-modal="true" aria-label="Choose an icon" onClick={() => setOpen(false)}>
          <div className="icon-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="icon-modal-head">
              <div className="icon-search">
                <Search size={16} />
                <input
                  className="icon-search-input"
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search icons…"
                  autoFocus
                />
              </div>
              <button type="button" className="btn-icon" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {filtered.length === 0 ? (
              <p className="icon-empty">No icons match “{query}”.</p>
            ) : (
              <div className="icon-grid">
                {filtered.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`icon-cell ${name === value ? 'active' : ''}`}
                    onClick={() => select(name)}
                    title={name}
                  >
                    <IconBadge name={name} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
