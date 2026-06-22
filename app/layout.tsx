import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers";
import { PUBLIC_BASE_URL } from "@/lib/public-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "Agendapy";
const TITLE_DEFAULT = "Agendapy — Turnos online para tu negocio en Paraguay";
const DESCRIPTION =
  "La forma más simple de gestionar turnos en Paraguay. Tus clientes reservan solos desde el celular y vos recibís el aviso por WhatsApp. Ideal para peluquerías, barberías, veterinarias y profesionales.";

// metadataBase resuelve las URLs relativas (OG image, canonical) contra el dominio
// real. Reutiliza PUBLIC_BASE_URL para no desalinear el host con los links compartidos.
export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_BASE_URL),
  // Las páginas hijas (ej. /[slug]) sustituyen %s; la home usa el título por defecto.
  title: {
    default: TITLE_DEFAULT,
    template: "%s · Agendapy",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "turnos online Paraguay",
    "agenda de citas online",
    "software para peluquerías",
    "sistema de reservas",
    "reservas para barberías",
    "agenda para veterinarias",
    "software de turnos",
    "citas online Paraguay",
    "reservar turno WhatsApp",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_PY",
    url: "/",
    title: TITLE_DEFAULT,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE_DEFAULT,
    description: DESCRIPTION,
  },
  // index/follow es el default, pero lo dejamos explícito para que no quede duda
  // de que NO hay noindex accidental a nivel global.
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
