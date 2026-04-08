'use client';
import Link from 'next/link';
import { ArrowLeft, Wallet } from 'lucide-react';

export default function Page() {
  return (
    <div className="min-h-screen bg-page text-heading">
      <header className="px-6 py-5 border-b border-border-default flex items-center gap-3">
        <Link href="/dashboard" className="text-tertiary hover:text-body transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-base font-semibold">Budget</h1>
      </header>
      <main className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-card-inner border border-border-default flex items-center justify-center mx-auto mb-5">
          <Wallet size={20} className="text-tertiary" />
        </div>
        <p className="text-sm font-medium text-body mb-2">Budget</p>
        <p className="text-xs text-muted">Panoramica del budget mensile.</p>
        <p className="text-[11px] text-muted mt-2">In costruzione</p>
      </main>
    </div>
  );
}
