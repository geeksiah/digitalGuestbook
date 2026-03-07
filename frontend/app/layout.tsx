import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import ServiceWorkerRegister from "./_components/ServiceWorkerRegister";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
});
const SITE_URL = "https://app.eventpeepo.com";
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: "Bespoke Digital Experiences.",
  description:
    "Your event's digital layer, handled. We design bespoke invitation suites and ensure seamless on-site access. You host; we manage the tech.",

  icons: {
    icon: "/img/icon.svg",
    shortcut: "/img/icon.svg",
    apple: "/img/icon.svg",
  },

  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Bespoke Digital Experiences.",
    description:
      "Your event's digital layer, handled. We design bespoke event solutions and ensure seamless on-site access. You host; we manage the tech.",
    siteName: "EventPeepo",
    images: [
      {
        url: "/og-app-eventpeepo.png",
        width: 1200,
        height: 630,
        alt: "EventPeepo - Bespoke Digital Experiences",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Bespoke Digital Experiences.",
    description:
      "Your event's digital layer, handled. We design bespoke invitation suites and ensure seamless on-site access. You host; we manage the tech.",
    images: ["/og-app-eventpeepo.png"],
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <head>
        <Script id="chunk-load-recovery" strategy="beforeInteractive">
          {`(() => {
  const retryFlag = "__ep_chunk_retry_done";
  let retried = (() => {
    try {
      return window.sessionStorage.getItem(retryFlag) === "1";
    } catch {
      return false;
    }
  })();

  const shouldRecover = (url) =>
    typeof url === "string" && url.includes("/_next/static/");

  const clearClientCaches = async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    } catch {}

    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {}
    }
  };

  window.addEventListener(
    "error",
    async (event) => {
      const target = event.target;
      const url = target && (target.src || target.href);
      if (!shouldRecover(url) || retried) return;

      try {
        window.sessionStorage.setItem(retryFlag, "1");
      } catch {}
      retried = true;
      await clearClientCaches();

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("__chunk_retry", "1");
      window.location.replace(nextUrl.toString());
    },
    true
  );
})();`}
        </Script>
      </head>
      <body className="font-sans">
        <ServiceWorkerRegister />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#121b28',
              color: '#ffffff',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 14px 34px rgba(5, 15, 32, 0.35)',
            },
            success: {
              iconTheme: {
                primary: '#1bd4bc',
                secondary: '#121b28',
              },
            },
          }}
        />
      </body>
    </html>
  );
}


