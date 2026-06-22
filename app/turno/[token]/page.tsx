import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canCancelNow, cancellationDeadline } from "@/lib/booking";
import { zonedToUtc } from "@/lib/timezone";
import { dateToISODate } from "@/lib/date";
import CancelButton from "./CancelButton";
import RescheduleForm from "./RescheduleForm";
import { formatDayMonthYear as formatLongDate, formatGs as formatPrice } from "@/lib/format";
import { serviceNames, servicesTotalPrice } from "@/lib/booking-summary";

export const metadata: Metadata = {
  title: "Mi reserva · Agendapy",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:   { label: "Pendiente de confirmación", bg: "#FEF3C7", color: "#92400E" },
  CONFIRMED: { label: "Confirmada",                bg: "#D1FAE5", color: "#065F46" },
  CANCELLED: { label: "Cancelada",                 bg: "#FEE2E2", color: "#991B1B" },
  COMPLETED: { label: "Realizada",                 bg: "#E0E7FF", color: "#3730A3" },
  NO_SHOW:   { label: "No asistió",                bg: "#F3F4F6", color: "#374151" },
};

const shell: React.CSSProperties = {
  minHeight: "100dvh",
  background: "#F5F7FA",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  padding: "32px 28px",
  maxWidth: 440,
  width: "100%",
  boxShadow: "0 8px 30px rgba(26,26,46,0.08)",
};

function Notice({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div style={shell}>
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: 12 }}>{emoji}</div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1A1A2E", marginBottom: 8 }}>{title}</h1>
        <p style={{ color: "#4A4A6A", fontSize: "0.95rem", lineHeight: 1.6 }}>{text}</p>
        <Link href="/" style={{ display: "inline-block", marginTop: 20, color: "#00C48C", fontWeight: 600, textDecoration: "none", fontSize: "0.9rem" }}>
          Ir a Agendapy
        </Link>
      </div>
    </div>
  );
}

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    include: {
      business: { select: { name: true, slug: true, whatsapp: true, timezone: true, cancellationWindowHours: true } },
      services: { select: { service: { select: { id: true, name: true, price: true } } } },
      client: { select: { name: true } },
    },
  });

  if (!booking) {
    return (
      <Notice
        emoji="🔍"
        title="Reserva no encontrada"
        text="El link que usaste no existe o ya no es válido. Si reservaste recién, revisá el mensaje original."
      />
    );
  }

  const ymd = dateToISODate(booking.date as Date);
  const svcs = booking.services.map((bs) => bs.service);
  const appointment = zonedToUtc(ymd, booking.startTime, booking.business.timezone);
  const windowHours = booking.business.cancellationWindowHours;
  const isActive = booking.status === "PENDING" || booking.status === "CONFIRMED";
  const cancellable = isActive && canCancelNow(appointment, windowHours);
  const status = STATUS_LABEL[booking.status] ?? STATUS_LABEL.PENDING;

  // Texto del deadline para el cliente (en hora del negocio).
  const deadline = cancellationDeadline(appointment, windowHours);
  const deadlineText = new Intl.DateTimeFormat("es-PY", {
    timeZone: booking.business.timezone,
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(deadline);

  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.04em", color: "#00C48C", textTransform: "uppercase" }}>
            {booking.business.name}
          </div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1A1A2E", margin: "6px 0 0" }}>
            Tu reserva
          </h1>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <span style={{ background: status.bg, color: status.color, fontWeight: 700, fontSize: "0.8rem", padding: "6px 14px", borderRadius: 999 }}>
            {status.label}
          </span>
        </div>

        <div style={{ borderTop: "1px solid #eef0f4" }}>
          <Row k="Cliente" v={booking.client.name} />
          <Row k={svcs.length > 1 ? "Servicios" : "Servicio"} v={serviceNames(svcs)} />
          <Row k="Fecha" v={formatLongDate(ymd)} />
          <Row k="Hora" v={`${booking.startTime} – ${booking.endTime} hs`} />
          <Row k="Precio" v={formatPrice(servicesTotalPrice(svcs))} />
        </div>

        {isActive && (
          cancellable ? (
            <div style={{ marginTop: 22 }}>
              <p style={{ fontSize: "0.82rem", color: "#8888aa", textAlign: "center", marginBottom: 14, lineHeight: 1.5 }}>
                {windowHours > 0
                  ? `Podés cancelar hasta el ${deadlineText} hs.`
                  : "Podés cancelar hasta el momento del turno."}
              </p>
              <div style={{ marginBottom: 12 }}>
                <RescheduleForm token={token} slug={booking.business.slug} serviceIds={svcs.map((s) => s.id)} />
              </div>
              <CancelButton token={token} />
            </div>
          ) : (
            <div style={{ marginTop: 22, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: "12px 16px" }}>
              <p style={{ fontSize: "0.85rem", color: "#9A3412", margin: 0, lineHeight: 1.5 }}>
                Ya pasó el plazo para cancelar online{windowHours > 0 ? ` (hasta ${windowHours} h antes del turno)` : ""}.
                {booking.business.whatsapp ? " Si necesitás cancelar, escribile al negocio." : ""}
              </p>
            </div>
          )
        )}

        {booking.business.whatsapp && isActive && (
          <a
            href={`https://wa.me/${booking.business.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", textAlign: "center", marginTop: 14, color: "#00C48C", fontWeight: 600, textDecoration: "none", fontSize: "0.88rem" }}
          >
            💬 Contactar al negocio
          </a>
        )}

        <a
          href={`/${booking.business.slug}`}
          style={{ display: "block", textAlign: "center", marginTop: 18, color: "#8888aa", fontSize: "0.82rem", textDecoration: "none" }}
        >
          Ver {booking.business.name}
        </a>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid #eef0f4" }}>
      <span style={{ color: "#8888aa", fontSize: "0.88rem" }}>{k}</span>
      <span style={{ color: "#1A1A2E", fontWeight: 600, fontSize: "0.9rem", textAlign: "right" }}>{v}</span>
    </div>
  );
}
