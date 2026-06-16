"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./booking.module.css";
import { formatDate, formatPrice } from "./format";

interface MyBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  manageToken: string | null;
  service: { name: string; price: number | null };
}

// Modal de autoconsulta de reservas por WhatsApp. Encapsula su estado y búsqueda;
// el padre solo controla el montaje (open) y el cierre (onClose).
export default function MyBookingsModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [wa, setWa] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<MyBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!/^\d{7,15}$/.test(wa)) {
      setError("Ingresá un número de WhatsApp válido (solo dígitos).");
      return;
    }
    setLoading(true);
    setError(null);
    setBookings(null);
    try {
      const res = await fetch(`/api/${slug}/my-bookings?whatsapp=${wa}`);
      const data = await res.json() as { bookings?: MyBooking[]; error?: string };
      if (!res.ok) { setError(data.error ?? "Error al buscar reservas."); return; }
      setBookings(data.bookings ?? []);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.myBookingsModal} onClick={e => e.stopPropagation()}>
        <div className={styles.myBookingsModalHeader}>
          <h3 className={styles.myBookingsModalTitle}>Mis reservas activas</h3>
          <button className={styles.myBookingsClose} onClick={onClose}>✕</button>
        </div>
        <p className={styles.myBookingsModalSub}>Ingresá el WhatsApp con el que reservaste</p>
        <div className={styles.myBookingsSearch}>
          <input
            type="tel"
            className={styles.myBookingsInput}
            placeholder="Ej: 0981123456"
            value={wa}
            onChange={e => { setWa(e.target.value.replace(/\D/g, "")); setBookings(null); setError(null); }}
            onKeyDown={e => e.key === "Enter" && search()}
            maxLength={15}
          />
          <button className={styles.myBookingsSearchBtn} onClick={search} disabled={loading}>
            {loading ? "..." : "Buscar"}
          </button>
        </div>
        {error && <div className={styles.myBookingsError}>{error}</div>}
        {bookings !== null && bookings.length === 0 && (
          <div className={styles.myBookingsEmpty}>No tenés reservas activas en este negocio.</div>
        )}
        {bookings && bookings.length > 0 && (
          <div className={styles.myBookingsList}>
            {bookings.map(b => (
              <div key={b.id} className={styles.myBookingItem}>
                <div className={styles.myBookingDate}>{formatDate(b.date.split("T")[0])}</div>
                <div className={styles.myBookingTime}>{b.startTime} – {b.endTime} hs</div>
                <div className={styles.myBookingService}>{b.service.name}{b.service.price != null ? ` · ${formatPrice(b.service.price)}` : ""}</div>
                <span className={styles.myBookingStatus}>{b.status === "PENDING" ? "Pendiente" : "Confirmado"}</span>
                {b.manageToken && (
                  <Link
                    href={`/turno/${b.manageToken}`}
                    style={{ display: "inline-block", marginTop: 8, color: "#00C48C", fontWeight: 600, fontSize: "0.8rem", textDecoration: "none" }}
                  >
                    Gestionar / cancelar →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
