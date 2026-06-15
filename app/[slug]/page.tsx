import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import BookingWizard from "./BookingWizard";

// Server Component: solo resuelve metadata (OG/SEO). La UI interactiva vive en
// BookingWizard (client). Antes la página era 100% client → los links compartidos
// por WhatsApp no tenían preview y el SEO era pobre.

async function getBusinessMeta(slug: string) {
  return prisma.business.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      logoUrl: true,
      coverUrl: true,
      isActive: true,
    },
  });
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBusinessMeta(slug).catch(() => null);

  if (!b || !b.isActive) {
    return { title: "Negocio no encontrado · Agendapy" };
  }

  const title = `${b.name} · Reservá tu turno online`;
  const description =
    b.description?.trim() ||
    `Reservá un turno en ${b.name} de forma rápida y online con Agendapy.`;
  const images = [b.coverUrl, b.logoUrl].filter(Boolean) as string[];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(images.length ? { images } : {}),
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title,
      description,
      ...(images.length ? { images } : {}),
    },
  };
}

export default function Page() {
  // El slug lo lee BookingWizard con useParams.
  return <BookingWizard />;
}
