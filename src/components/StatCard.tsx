import type { LucideIcon } from 'lucide-react';

export function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300">
        <Icon size={20} />
      </div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
    </div>
  );
}
