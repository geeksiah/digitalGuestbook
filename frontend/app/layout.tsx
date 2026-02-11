import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import ServiceWorkerRegister from "./_components/ServiceWorkerRegister";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
});
const SITE_URL = "https://app.eventpeepo.com";
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: "Bespoke Digital Experiences.",
  description:
    "Your event's digital layer, handled. We design bespoke invitation suites and ensure seamless on-site access. You host; we manage the tech.",

  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },

  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Bespoke Digital Experiences.",
    description:
      "Your event's digital layer, handled. We design bespoke invitation suites and ensure seamless on-site access. You host; we manage the tech.",
    siteName: "EventPeepo",
    images: [
      {
        url: "/og-app-eventpeepo.png",
        width: 1200,
        height: 630,
        alt: "EventPeepo — Bespoke Digital Experiences",
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
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans">
        <ServiceWorkerRegister /> {/* ✅ ADD THIS */}
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1a2e',
              color: '#fff',
              borderRadius: '8px',
            },
            success: {
              iconTheme: {
                primary: '#d4af37',
                secondary: '#1a1a2e',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
