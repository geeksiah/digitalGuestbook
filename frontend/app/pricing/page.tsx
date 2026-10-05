'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Globe2, Mail, QrCode, Sparkles } from 'lucide-react';
import { EventPeepoLogo } from '@/components/EventPeepoLogo';
import { publicApi } from '@/lib/api';

type Plan = { key: string; name: string; price: string; priceSuffix?: string; description: string; featured?: boolean; features: string[] };
type PricingConfig = {
  currency: string;
  plans: Plan[];
  sharedFeatures: string[];
  customDomainAddon: { enabled: boolean; name: string; price: string; description: string };
  customService: { title: string; description: string; contactUrl: string };
};

const fallback: PricingConfig = {
  currency: 'GHS',
  plans: [],
  sharedFeatures: ['Automatic SMS and email guest notifications', 'Mobile-browser ticket / invitation code verification and scanning'],
  customDomainAddon: { enabled: true, name: 'Custom Domain Add-on', price: '', description: 'Add a custom domain to Starter or Gold. Platinum already includes a custom domain.' },
  customService: { title: 'Need something more tailored?', description: 'Talk to us about a custom EventPeepo experience built around your event.', contactUrl: 'https://eventpeepo.com/#contact' },
};

function Price({ plan, currency }: { plan: Plan; currency: string }) {
  if (!plan.price) return <div className="text-2xl font-bold text-[#063932]">Contact us</div>;
  return <div className="flex items-end gap-2"><span className="pb-1 text-sm font-bold text-gray-400">{currency}</span><span className="text-4xl font-black tracking-tight text-[#063932]">{plan.price}</span>{plan.priceSuffix && <span className="pb-1 text-sm text-gray-500">{plan.priceSuffix}</span>}</div>;
}

export default function PricingPage() {
  const [config, setConfig] = useState<PricingConfig>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi.getPricing().then((r) => setConfig(r.data?.pricing || fallback)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f9f8] text-slate-900">
      <nav className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3"><EventPeepoLogo className="w-12 h-auto"/><span className="text-xl font-bold text-[#063932]">EventPeepo.</span></Link>
          <div className="flex items-center gap-3"><a href="https://eventpeepo.com/#contact" className="hidden text-sm font-semibold text-gray-600 sm:block">Contact us</a><Link href="/owner/login" className="rounded-xl bg-[#063932] px-5 py-2.5 text-sm font-bold text-white">Client Dashboard</Link></div>
        </div>
      </nav>

      <section className="px-6 pb-14 pt-20 text-center sm:pt-24">
        <div className="mx-auto max-w-4xl">
          <span className="inline-flex rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-[#8a6b13]">EventPeepo Packages</span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-[#063932] sm:text-6xl">Simple plans. Better event experiences.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-gray-600 sm:text-lg">From invitations and RSVPs to ticket verification, gifting, memories and live itineraries — choose the digital experience that fits your event.</p>
          <p className="mt-4 text-sm font-semibold text-[#063932]/70">Weddings · Conferences · Parties · Graduations · Corporate events · Launches · Private & ticketed events</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        {loading ? <div className="py-20 text-center text-gray-500">Loading packages…</div> : (
          <div className="grid gap-6 lg:grid-cols-3">
            {config.plans.map((plan) => (
              <article key={plan.key} className={`relative flex flex-col rounded-[28px] border bg-white p-7 shadow-sm sm:p-8 ${plan.featured ? 'border-[#d4af37] ring-1 ring-[#d4af37]/20 lg:-translate-y-3' : 'border-gray-200'}`}>
                {plan.featured && <span className="absolute right-6 top-6 rounded-full bg-[#063932] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">Popular</span>}
                <p className="text-sm font-bold uppercase tracking-[.16em] text-[#b38b35]">{plan.name}</p>
                <div className="mt-5"><Price plan={plan} currency={config.currency}/></div>
                <p className="mt-4 min-h-12 text-sm leading-6 text-gray-500">{plan.description}</p>
                <div className="my-7 h-px bg-gray-100"/>
                <ul className="flex-1 space-y-4">{plan.features.map((feature, i) => <li key={i} className="flex gap-3 text-sm leading-6 text-gray-700"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50"><Check className="h-3.5 w-3.5 text-emerald-700"/></span>{feature}</li>)}</ul>
                <a href={config.customService.contactUrl || 'https://eventpeepo.com/#contact'} className={`mt-8 block rounded-xl px-5 py-3.5 text-center text-sm font-bold ${plan.featured ? 'bg-[#063932] text-white' : 'border border-[#063932]/20 text-[#063932] hover:bg-[#063932] hover:text-white'}`}>Choose {plan.name}</a>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="bg-[#063932] px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#d4af37]">Included in every package</p><h2 className="mt-4 text-3xl font-bold sm:text-4xl">The essentials don't become paid extras.</h2></div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {config.sharedFeatures.map((feature, i) => <div key={i} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.06] p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">{i === 0 ? <Mail className="h-5 w-5 text-[#d4af37]"/> : <QrCode className="h-5 w-5 text-[#d4af37]"/>}</div><p className="pt-2 text-sm leading-6 text-white/80">{feature}</p></div>)}
          </div>
        </div>
      </section>

      {config.customDomainAddon.enabled && <section className="px-6 py-20"><div className="mx-auto flex max-w-5xl flex-col justify-between gap-8 rounded-[30px] border border-gray-200 bg-white p-8 shadow-sm md:flex-row md:items-center md:p-10"><div className="flex gap-5"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#063932]/5"><Globe2 className="text-[#063932]"/></div><div><p className="text-xs font-bold uppercase tracking-widest text-[#b38b35]">Optional add-on</p><h2 className="mt-2 text-2xl font-bold text-[#063932]">{config.customDomainAddon.name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{config.customDomainAddon.description}</p></div></div><div className="shrink-0 text-left md:text-right">{config.customDomainAddon.price ? <><div className="text-xs font-bold text-gray-400">{config.currency}</div><div className="text-3xl font-black text-[#063932]">{config.customDomainAddon.price}</div></> : <div className="text-lg font-bold text-[#063932]">Ask us</div>}</div></div></section>}

      <section className="px-6 pb-24"><div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] bg-[#efe8d7] p-8 sm:p-12"><Sparkles className="h-7 w-7 text-[#9a7827]"/><h2 className="mt-5 text-3xl font-black text-[#063932]">{config.customService.title}</h2><p className="mt-4 max-w-2xl leading-7 text-gray-700">{config.customService.description}</p><a href={config.customService.contactUrl} className="mt-7 inline-flex rounded-xl bg-[#063932] px-6 py-3.5 text-sm font-bold text-white">Talk to EventPeepo</a></div></section>

      <footer className="border-t border-gray-200 bg-white px-6 py-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-xs text-gray-400 sm:flex-row"><span>© {new Date().getFullYear()} EventPeepo Inc.</span><span>Digital experiences for every kind of event.</span></div></footer>
    </main>
  );
}
