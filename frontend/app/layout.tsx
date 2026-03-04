import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
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
    icon: "/favicon.ico",
    apple: "/favicon.ico",
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
                primary: '#ff3b30',
                secondary: '#121b28',
              },
            },
          }}
        />
      </body>
    </html>
  );
}


