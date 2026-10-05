'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { EventPeepoLogo } from '@/components/EventPeepoLogo';
import { publicApi } from '@/lib/api';

type Plan = {
  key: string;
  name: string;
  price: string;
  priceSuffix?: string;
  description: string;
  featured?: boolean;
  features: string[];
};

type PricingConfig = {
  currency: string;
  plans: Plan[];
  sharedFeatures: string[];
  customDomainAddon: {
    enabled: boolean;
    name: string;
    price: string;
    description: string;
  };
  customService: {
    title: string;
    description: string;
    contactUrl: string;
  };
};

const fallback: PricingConfig = {
  currency: 'GHS',
  plans: [],
  sharedFeatures: [
    'Automatic SMS and email guest notifications',
    'Mobile-browser ticket / invitation code verification and scanning',
  ],
  customDomainAddon: {
    enabled: true,
    name: 'Custom Domain Add-on',
    price: '',
    description:
      'Add a custom domain to Starter or Gold. Platinum already includes a custom domain.',
  },
  customService: {
    title: 'Need something more tailored?',
    description:
      'Talk to us about a custom EventPeepo experience built around your event.',
    contactUrl: 'https://eventpeepo.com/#contact',
  },
};

function Price({
  plan,
  currency,
}: {
  plan: Plan;
  currency: string;
}) {
  if (!plan.price) {
    return (
      <div className="text-3xl font-bold tracking-tight text-[#063932]">
        Contact us
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <span className="pb-1 text-lg font-medium text-slate-600">
        {currency}
      </span>

      <span className="text-5xl font-black tracking-[-0.04em] text-[#0b1720]">
        {plan.price}
      </span>

      {plan.priceSuffix && (
        <span className="pb-1 text-sm text-slate-500">
          {plan.priceSuffix}
        </span>
      )}
    </div>
  );
}

export default function PricingPage() {
  const [config, setConfig] = useState<PricingConfig>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi
      .getPricing()
      .then((r) => {
        const incoming = r.data?.pricing;

        if (!incoming) {
          setConfig(fallback);
          return;
        }

        setConfig({
          ...fallback,
          ...incoming,

          plans: Array.isArray(incoming.plans)
            ? incoming.plans
            : fallback.plans,

          sharedFeatures: Array.isArray(incoming.sharedFeatures)
            ? incoming.sharedFeatures
            : fallback.sharedFeatures,

          customDomainAddon: {
            ...fallback.customDomainAddon,
            ...(incoming.customDomainAddon || {}),
          },

          customService: {
            ...fallback.customService,
            ...(incoming.customService || {}),
          },
        });
      })
      .catch(() => setConfig(fallback))
      .finally(() => setLoading(false));
  }, []);

  /*
   * Build the comparison automatically from the Admin-controlled
   * plan features instead of maintaining a second hard-coded list.
   */
  const comparisonFeatures = useMemo(() => {
    const features: string[] = [];

    config.plans.forEach((plan) => {
      plan.features.forEach((feature) => {
        const normalized = feature.trim();

        if (
          normalized &&
          !features.some(
            (existing) =>
              existing.toLowerCase() === normalized.toLowerCase()
          )
        ) {
          features.push(normalized);
        }
      });
    });

    return features;
  }, [config.plans]);

  const planHasFeature = (plan: Plan, feature: string) => {
    return plan.features.some(
      (item) =>
        item.trim().toLowerCase() === feature.trim().toLowerCase()
    );
  };

  return (
    <main className="min-h-screen bg-[#fafbfa] text-[#0b1720]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <EventPeepoLogo className="h-auto w-10 sm:w-11" />
            <span className="text-lg font-bold tracking-tight text-[#063932]">
              EventPeepo.
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
            <Link
              href="/"
              className="transition-colors hover:text-[#063932]"
            >
              Home
            </Link>

            <Link
              href="/#features"
              className="transition-colors hover:text-[#063932]"
            >
              Features
            </Link>

            <Link
              href="/#templates"
              className="transition-colors hover:text-[#063932]"
            >
              Templates
            </Link>

            <span className="rounded-full bg-[#edf5f1] px-4 py-2 text-[#063932]">
              Pricing
            </span>

            <Link
              href="/#about"
              className="transition-colors hover:text-[#063932]"
            >
              About
            </Link>

            <Link
              href="/#contact"
              className="transition-colors hover:text-[#063932]"
            >
              Contact
            </Link>
          </nav>

          <Link
            href="/owner/login"
            className="rounded-xl bg-[#063932] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0a4b42] sm:px-5 sm:text-sm"
          >
            Client Dashboard
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 pb-12 pt-16 text-center sm:px-6 sm:pb-16 sm:pt-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
            EventPeepo Packages
          </p>

          <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-[#0b1720] sm:text-5xl lg:text-6xl">
            Simple plans for better
            <br className="hidden sm:block" /> event experiences.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
            From invitations and RSVPs to ticket verification, gifting,
            memories and live itineraries. Choose the plan that fits your
            event.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6">
        {loading ? (
          <div className="py-24 text-center text-sm text-slate-500">
            Loading packages…
          </div>
        ) : config.plans.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center">
            <p className="text-sm text-slate-500">
              Pricing packages are being updated.
            </p>
          </div>
        ) : (
          <div className="grid items-stretch gap-5 lg:grid-cols-3">
            {config.plans.map((plan) => (
              <article
                key={plan.key}
                className={`relative flex min-h-[500px] flex-col rounded-[22px] border bg-white p-7 sm:p-8 ${
                  plan.featured
                    ? 'border-[#d6aa3d] shadow-[0_12px_40px_rgba(186,143,36,0.10)]'
                    : 'border-slate-200 shadow-[0_8px_30px_rgba(15,23,42,0.035)]'
                }`}
              >
                <div className="flex min-h-7 items-start justify-between gap-4">
                  <p
                    className={`text-xs font-bold uppercase tracking-[0.22em] ${
                      plan.featured
                        ? 'text-[#b17e0c]'
                        : 'text-[#063932]'
                    }`}
                  >
                    {plan.name}
                  </p>

                  {plan.featured && (
                    <span className="rounded-full bg-[#d6aa3d] px-3 py-1 text-[10px] font-bold text-white">
                      Most Popular
                    </span>
                  )}
                </div>

                <div className="mt-7">
                  <Price plan={plan} currency={config.currency} />
                </div>

                <p className="mt-4 min-h-[48px] text-sm leading-6 text-slate-500">
                  {plan.description}
                </p>

                <div className="my-7 border-t border-slate-100" />

                <ul className="flex-1 space-y-4">
                  {plan.features.map((feature, index) => (
                    <li
                      key={`${plan.key}-${index}`}
                      className="flex items-start gap-3 text-sm leading-6 text-slate-600"
                    >
                      <Check className="mt-1 h-4 w-4 shrink-0 stroke-[2.5] text-[#063932]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={
                    config.customService.contactUrl ||
                    'https://eventpeepo.com/#contact'
                  }
                  className={`mt-8 block rounded-xl px-5 py-3.5 text-center text-sm font-bold transition ${
                    plan.featured
                      ? 'bg-[#063932] text-white hover:bg-[#0a4b42]'
                      : 'border border-[#063932]/40 text-[#063932] hover:bg-[#063932] hover:text-white'
                  }`}
                >
                  Choose {plan.name}
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Comparison */}
      {!loading &&
        config.plans.length > 0 &&
        comparisonFeatures.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6">
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
              <div className="grid lg:grid-cols-[300px_1fr]">
                <div className="border-b border-slate-200 p-7 sm:p-9 lg:border-b-0 lg:border-r">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                    Plan comparison
                  </p>

                  <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-[#063932]">
                    Compare plans
                    <br />
                    at a glance.
                  </h2>

                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    See what&apos;s included in each package.
                  </p>
                </div>

                <div className="overflow-x-auto p-4 sm:p-6">
                  <table className="w-full min-w-[620px] border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-semibold text-slate-500">
                          Feature
                        </th>

                        {config.plans.map((plan) => (
                          <th
                            key={plan.key}
                            className="border-b border-slate-200 px-4 py-4 text-center text-xs font-bold text-[#063932]"
                          >
                            {plan.name}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {comparisonFeatures.map((feature) => (
                        <tr
                          key={feature}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-4 py-3.5 text-xs text-slate-600 sm:text-sm">
                            {feature}
                          </td>

                          {config.plans.map((plan) => (
                            <td
                              key={`${plan.key}-${feature}`}
                              className="px-4 py-3.5 text-center"
                            >
                              {planHasFeature(plan, feature) ? (
                                <Check className="mx-auto h-4 w-4 stroke-[2.5] text-[#063932]" />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

      {/* Custom domain */}
      {config.customDomainAddon.enabled && (
        <section className="mx-auto max-w-7xl px-5 pb-6 sm:px-6">
          <div className="flex flex-col gap-6 rounded-[22px] border border-slate-200 bg-white px-7 py-7 sm:px-9 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Optional add-on
              </p>

              <h2 className="mt-2 text-xl font-bold tracking-tight text-[#0b1720]">
                {config.customDomainAddon.name}
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                {config.customDomainAddon.description}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-8">
              <div>
                {config.customDomainAddon.price ? (
                  <div className="flex items-end gap-2">
                    <span className="pb-1 text-sm text-slate-500">
                      {config.currency}
                    </span>

                    <span className="text-3xl font-black tracking-tight text-[#063932]">
                      {config.customDomainAddon.price}
                    </span>
                  </div>
                ) : (
                  <span className="text-lg font-bold text-[#063932]">
                    Ask us
                  </span>
                )}
              </div>

              <a
                href={
                  config.customService.contactUrl ||
                  'https://eventpeepo.com/#contact'
                }
                className="hidden rounded-xl border border-[#063932]/40 px-5 py-3 text-sm font-bold text-[#063932] transition hover:bg-[#063932] hover:text-white sm:block"
              >
                Add-on details
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Custom service */}
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-3 sm:px-6">
        <div className="flex flex-col gap-6 rounded-[22px] bg-[#f4efe3] px-7 py-8 sm:px-9 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Custom solutions
            </p>

            <h2 className="mt-3 text-2xl font-black tracking-[-0.025em] text-[#063932]">
              {config.customService.title}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {config.customService.description}
            </p>
          </div>

          <a
            href={
              config.customService.contactUrl ||
              'https://eventpeepo.com/#contact'
            }
            className="shrink-0 self-start rounded-xl bg-[#063932] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#0a4b42] md:self-auto"
          >
            Talk to EventPeepo
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-xs text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <EventPeepoLogo className="h-auto w-8" />
            <span>
              © {new Date().getFullYear()} EventPeepo Inc.
            </span>
          </div>

          <div className="flex gap-6">
            <Link href="/" className="hover:text-[#063932]">
              Home
            </Link>

            <Link href="/#contact" className="hover:text-[#063932]">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}