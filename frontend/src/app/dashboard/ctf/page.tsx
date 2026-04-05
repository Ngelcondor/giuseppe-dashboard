'use client';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function Page() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100">
      <header className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-base font-semibold">CTF Tracker</h1>
      </header>
      <main className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center mx-auto mb-5">
          <Shield size={20} className="text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-300 mb-2">CTF Tracker</p>
        <p className="text-xs text-slate-600">Traccia le tue challenge di sicurezza informatica.</p>
        <p className="text-[11px] text-slate-700 mt-2">In costruzione</p>
      </main>
    </div>
  );
}
