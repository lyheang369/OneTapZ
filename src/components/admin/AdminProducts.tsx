import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { AdminProduct } from '../../lib/types';

const emptyNew = { name: '', slug: '', price: 2, discountPrice: 1, description: '' };

function messageFrom(err: unknown): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const res = (err as { response?: { data?: { message?: string } } }).response;
    if (res?.data?.message) return res.data.message;
  }
  return 'Something went wrong. Please try again.';
}

export function AdminProducts() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(emptyNew);

  useEffect(() => {
    api
      .get('/admin/products')
      .then(({ data }) => setProducts(data.products ?? []))
      .catch(() => setError('Could not load products.'));
  }, []);

  function patch(id: string, field: keyof AdminProduct, value: string | number | boolean) {
    setProducts((prev) => prev.map((p) => (p._id === id ? { ...p, [field]: value } : p)));
  }

  async function save(p: AdminProduct) {
    setError('');
    try {
      const { data } = await api.put(`/admin/products/${p._id}`, {
        name: p.name,
        description: p.description,
        price: Number(p.price),
        discountPrice: Number(p.discountPrice),
        active: p.active,
      });
      setProducts((prev) => prev.map((x) => (x._id === p._id ? data.product : x)));
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  async function remove(id: string) {
    setError('');
    try {
      await api.delete(`/admin/products/${id}`);
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/admin/products', {
        ...adding,
        price: Number(adding.price),
        discountPrice: Number(adding.discountPrice),
      });
      setProducts((prev) => [...prev, data.product]);
      setAdding(emptyNew);
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  return (
    <section className="panel p-6">
      <h2 className="mb-1 text-xl font-bold text-white">Shop products</h2>
      <p className="mb-4 text-sm text-slate-400">Edit prices, discounts and availability. Set discount to 0 for no discount.</p>
      {error && <p className="alert mb-3">{error}</p>}

      <div className="space-y-5">
        {products.map((p) => (
          <div key={p._id} className="panel space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Name
                <input className="input" value={p.name} onChange={(e) => patch(p._id, 'name', e.target.value)} />
              </label>
              <label className="field-label">
                Slug
                <input className="input" value={p.slug} disabled />
              </label>
              <label className="field-label">
                Full price ($)
                <input className="input" type="number" step="0.01" min="0" value={p.price} onChange={(e) => patch(p._id, 'price', e.target.value)} />
              </label>
              <label className="field-label">
                Discount price ($, 0 = none)
                <input className="input" type="number" step="0.01" min="0" value={p.discountPrice} onChange={(e) => patch(p._id, 'discountPrice', e.target.value)} />
              </label>
            </div>
            <label className="field-label">
              Description
              <input className="input" value={p.description} onChange={(e) => patch(p._id, 'description', e.target.value)} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={p.active} onChange={(e) => patch(p._id, 'active', e.target.checked)} />
                Active
              </label>
              <button className="btn-primary btn-text" type="button" onClick={() => save(p)}>
                <Save size={16} />
                Save
              </button>
              <button className="btn-text" type="button" onClick={() => remove(p._id)}>
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <form className="mt-6 border-t border-white/10 pt-5" onSubmit={add}>
        <h3 className="mb-3 font-bold text-white">Add product</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Name
            <input className="input" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} required />
          </label>
          <label className="field-label">
            Slug (optional)
            <input className="input" value={adding.slug} onChange={(e) => setAdding({ ...adding, slug: e.target.value })} />
          </label>
          <label className="field-label">
            Full price ($)
            <input className="input" type="number" step="0.01" min="0" value={adding.price} onChange={(e) => setAdding({ ...adding, price: Number(e.target.value) })} />
          </label>
          <label className="field-label">
            Discount price ($)
            <input className="input" type="number" step="0.01" min="0" value={adding.discountPrice} onChange={(e) => setAdding({ ...adding, discountPrice: Number(e.target.value) })} />
          </label>
        </div>
        <label className="field-label mt-3">
          Description
          <input className="input" value={adding.description} onChange={(e) => setAdding({ ...adding, description: e.target.value })} />
        </label>
        <button className="btn-primary btn-text mt-3" type="submit">
          <Plus size={16} />
          Add product
        </button>
      </form>
    </section>
  );
}
