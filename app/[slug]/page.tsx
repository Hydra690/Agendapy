"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import styles from "./booking.module.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// ---- Types ----

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
}

interface Availability {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

interface Review {
  id: string;
  reviewerName: string;
  text: string;
  rating: number;
  createdAt: string;
}

interface Business {
  name: string;
  slug: string;
  category: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  instagram: string | null;
  facebook: string | null;
  services: Service[];
  availability: Availability[];
  reviews: Review[];
}

interface BookingResult {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  service: { name: string; price: number | null };
  client: { name: string };
}

// ---- Constants ----

const CATEGORY_INFO: Record<string, { emoji: string; label: string }> = {
  BARBERSHOP:   { emoji: "✂️",  label: "Barbería" },
  BEAUTY_SALON: { emoji: "💅",  label: "Salón de belleza" },
  VETERINARY:   { emoji: "🐾",  label: "Veterinaria" },
  PSYCHOLOGY:   { emoji: "🧠",  label: "Psicología" },
  DENTISTRY:    { emoji: "🦷",  label: "Odontología" },
  MEDICINE:     { emoji: "🩺",  label: "Medicina" },
  FITNESS:      { emoji: "🏋️", label: "Fitness" },
  PHOTOGRAPHY:  { emoji: "📸",  label: "Fotografía" },
  TUTORING:     { emoji: "📚",  label: "Clases particulares" },
  MASSAGE:      { emoji: "💆",  label: "Masajes" },
  OTHER:        { emoji: "📋",  label: "Servicios" },
};

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const JS_DAY_TO_ENUM = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_LABEL: Record<string, string> = {
  MONDAY:    "Lun",
  TUESDAY:   "Mar",
  WEDNESDAY: "Mié",
  THURSDAY:  "Jue",
  FRIDAY:    "Vie",
  SATURDAY:  "Sáb",
  SUNDAY:    "Dom",
};

// ---- Helpers ----

function formatPrice(price: number | null): string {
  if (price === null) return "A consultar";
  return `Gs. ${new Intl.NumberFormat("es-PY").format(price)}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("es-PY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isDotDone(current: 1 | 2 | 3 | "success", dot: 1 | 2 | 3): boolean {
  if (current === "success") return true;
  return (current as number) > dot;
}

// ---- Sub-components ----

function Navbar() {
  return (
    <nav className={styles.nav}>
      <a href="/" className={styles.navLogo}>
        agenda<span className={styles.navLogoAccent}>py</span>
      </a>
    </nav>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <a href="/" className={styles.footerLink}>
        Powered by <strong>agendapy</strong>
      </a>
    </footer>
  );
}

// ---- Page ----

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Page state
  const [business, setBusiness] = useState<Business | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | "success">(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [dayClosedError, setDayClosedError] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [noSlots, setNoSlots] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ reviewerName: "", text: "", rating: 5 });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewDone, setReviewDone] = useState(false);

  // My bookings modal state
  const [myBookingsOpen, setMyBookingsOpen] = useState(false);
  const [myBookingsWa, setMyBookingsWa] = useState("");
  const [myBookingsLoading, setMyBookingsLoading] = useState(false);
  const [myBookings, setMyBookings] = useState<{ id: string; date: string; startTime: string; endTime: string; status: string; service: { name: string; price: number | null } }[] | null>(null);
  const [myBookingsError, setMyBookingsError] = useState<string | null>(null);

  // Form state
  const [clientName, setClientName] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  useEffect(() => {
    fetch(`/api/${slug}`)
      .then((res) => {
        if (res.status === 404) { setNotFound(true); return null; }
        if (!res.ok) { setNotFound(true); return null; }
        return res.json() as Promise<Business>;
      })
      .then((data) => { if (data) setBusiness(data); })
      .catch(() => setNotFound(true))
      .finally(() => setPageLoading(false));
  }, [slug]);

  const fetchSlots = useCallback(
    async (date: string) => {
      if (!selectedService || !date) return;
      setSlotsLoading(true);
      setSlots([]);
      setNoSlots(false);
      setBlockedReason(null);
      setSelectedSlot(null);
      try {
        const res = await fetch(
          `/api/${slug}/slots?date=${date}&serviceId=${selectedService.id}`
        );
        const data = await res.json() as { available: boolean; reason?: string; slots?: string[] };
        if (!data.available) {
          setBlockedReason(data.reason ?? "Este día no está disponible.");
        } else if (!data.slots?.length) {
          setNoSlots(true);
        } else {
          setSlots(data.slots);
        }
      } catch {
        setNoSlots(true);
      } finally {
        setSlotsLoading(false);
      }
    },
    [slug, selectedService]
  );

  useEffect(() => {
    if (step === 2 && selectedDate && !dateError) {
      fetchSlots(selectedDate);
    }
  }, [step, selectedDate, dateError, fetchSlots]);

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewForm),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) { setReviewError(data.error ?? "Error al enviar."); return; }
      setReviewDone(true);
    } catch {
      setReviewError("No se pudo conectar con el servidor.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedSlot || !selectedDate) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/${slug}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          date: selectedDate,
          startTime: selectedSlot,
          clientName: clientName.trim(),
          clientWhatsapp: clientWhatsapp.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json() as { booking?: BookingResult; error?: string };
      if (res.status === 409) {
        setSubmitError("Este horario ya fue tomado mientras confirmabas. Por favor elegí otro.");
        setStep(2);
        fetchSlots(selectedDate);
        return;
      }
      if (!res.ok) {
        setSubmitError(data.error ?? "Ocurrió un error. Intentá de nuevo.");
        return;
      }
      setBookingResult(data.booking!);
      setStep("success");
    } catch {
      setSubmitError("No se pudo conectar con el servidor. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchMyBookings() {
    if (!/^\d{7,15}$/.test(myBookingsWa)) {
      setMyBookingsError("Ingresá un número de WhatsApp válido (solo dígitos).");
      return;
    }
    setMyBookingsLoading(true);
    setMyBookingsError(null);
    setMyBookings(null);
    try {
      const res = await fetch(`/api/${slug}/my-bookings?whatsapp=${myBookingsWa}`);
      const data = await res.json() as { bookings?: typeof myBookings; error?: string };
      if (!res.ok) { setMyBookingsError(data.error ?? "Error al buscar reservas."); return; }
      setMyBookings(data.bookings ?? []);
    } catch {
      setMyBookingsError("No se pudo conectar con el servidor.");
    } finally {
      setMyBookingsLoading(false);
    }
  }

  function resetWizard() {
    setStep(1);
    setSelectedService(null);
    setSelectedDate("");
    setDateError(null);
    setDayClosedError(false);
    setSlots([]);
    setNoSlots(false);
    setBlockedReason(null);
    setSelectedSlot(null);
    setClientName("");
    setClientWhatsapp("");
    setNotes("");
    setSubmitError(null);
    setBookingResult(null);
  }

  const cat = business
    ? (CATEGORY_INFO[business.category] ?? CATEGORY_INFO.OTHER)
    : null;

  const sortedAvailability = business
    ? [...business.availability].sort(
        (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
      )
    : [];

  const activeDays = new Set(business?.availability.map(a => a.dayOfWeek) ?? []);

  const availSummary = (() => {
    if (!business || business.availability.length === 0) return null;
    const sorted = [...business.availability].sort(
      (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
    );
    const allSame = sorted.every(
      a => a.startTime === sorted[0].startTime && a.endTime === sorted[0].endTime
    );
    const days = sorted.map(a => DAY_LABEL[a.dayOfWeek]).join(", ");
    if (allSame) return `${days} · ${sorted[0].startTime}–${sorted[0].endTime}`;
    return sorted.map(a => `${DAY_LABEL[a.dayOfWeek]} ${a.startTime}–${a.endTime}`).join(" / ");
  })();

  // ---- RENDER ----

  if (pageLoading) {
    return (
      <div className={jakarta.className} style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#F5F7FA" }}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonLine} style={{ width: "55%", height: 28 }} />
            <div className={styles.skeletonLine} style={{ width: "35%", height: 18 }} />
            <div className={styles.skeletonLine} style={{ height: 72 }} />
            <div className={styles.skeletonLine} style={{ height: 72 }} />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className={jakarta.className} style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#F5F7FA" }}>
        <Navbar />
        <main className={styles.main}>
          <div
            className={styles.card}
            style={{ textAlign: "center", padding: "52px 32px", marginTop: 24 }}
          >
            <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>🔍</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 10, color: "#1A1A2E" }}>
              Este negocio no está disponible
            </h2>
            <p style={{ color: "#4A4A6A", fontSize: "0.95rem", lineHeight: 1.6 }}>
              El link que usaste no existe o el negocio fue desactivado.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div
      className={jakarta.className}
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: step === "success" ? "#1A1A2E" : "#F5F7FA",
        transition: "background 0.3s",
      }}
    >
      <Navbar />
      <main className={styles.main}>

        {/* Cover image */}
        {business.coverUrl && step !== "success" && (
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
            <img
              src={business.coverUrl}
              alt={`${business.name} portada`}
              style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        {/* Business header */}
        <div className={styles.businessHeader}>
          {business.logoUrl ? (
            <img src={business.logoUrl} alt={business.name} className={styles.businessLogo} />
          ) : (
            <div className={styles.businessIcon}>{cat?.emoji}</div>
          )}
          <div>
            <h1 className={styles.businessName}>{business.name}</h1>
            <span className={styles.categoryBadge}>{cat?.label}</span>
          </div>
        </div>

        {/* Address, phone, social info bar */}
        {(business.address || business.phone || business.instagram || business.facebook) && step !== "success" && (
          <div className={styles.bizInfoBar}>
            {business.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(business.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.bizInfoItem}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span className={styles.bizInfoIcon}>📍</span>
                {business.address}
              </a>
            )}
            {business.phone && (
              <span className={styles.bizInfoItem}>
                <span className={styles.bizInfoIcon}>📞</span>
                {business.phone}
              </span>
            )}
            {business.instagram && (
              <a
                href={`https://instagram.com/${business.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.bizInfoItem}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span className={styles.bizInfoIcon}>📸</span>
                @{business.instagram}
              </a>
            )}
            {business.facebook && (
              <a
                href={business.facebook.startsWith("http") ? business.facebook : `https://facebook.com/${business.facebook}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.bizInfoItem}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span className={styles.bizInfoIcon}>👍</span>
                Facebook
              </a>
            )}
          </div>
        )}

        {business.services.length === 0 ? (
          <div className={styles.noServicesCard}>
            <div className={styles.noServicesIcon}>📅</div>
            <h2 className={styles.noServicesTitle}>{business.name}</h2>
            <p className={styles.noServicesMsg}>
              Este negocio todavía no tiene servicios disponibles. Volvé más tarde.
            </p>
          </div>
        ) : (
          <>
        {/* Step progress dots */}
        {step !== "success" && (
          <div className={styles.stepProgress}>
            {([1, 2, 3] as const).map((n) => (
              <div
                key={n}
                className={[
                  styles.stepDot,
                  step === n ? styles.stepDotActive : "",
                  isDotDone(step, n) ? styles.stepDotDone : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ))}
          </div>
        )}

        {/* ======== STEP 1 — Elegir servicio ======== */}
        {step === 1 && (
          <div>
            <h2 className={styles.stepTitle}>¿Qué servicio querés reservar?</h2>
            {business.description && (
              <p className={styles.businessDesc}>{business.description}</p>
            )}

            {/* Schedule card */}
            {sortedAvailability.length > 0 && (
              <div className={styles.scheduleCard}>
                <div className={styles.scheduleCardTitle}>Horarios de atención</div>
                <div className={styles.scheduleCardGrid}>
                  {sortedAvailability.map((av) => (
                    <div key={av.dayOfWeek} className={styles.scheduleCardRow}>
                      <span className={styles.scheduleCardDay}>
                        {DAY_LABEL[av.dayOfWeek] ?? av.dayOfWeek}
                      </span>
                      <span className={styles.scheduleCardTime}>
                        {av.startTime} – {av.endTime}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews section */}
            {business.reviews.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1A1A2E" }}>
                    Lo que dicen nuestros clientes
                  </span>
                  <button
                    onClick={() => { setReviewModalOpen(true); setReviewDone(false); setReviewError(null); setReviewForm({ reviewerName: "", text: "", rating: 5 }); }}
                    style={{ background: "none", border: "1.5px solid #e8eaf0", borderRadius: 8, padding: "4px 12px", fontSize: "0.78rem", color: "#4A4A6A", cursor: "pointer", fontWeight: 600 }}
                  >
                    + Tu opinión
                  </button>
                </div>
                {business.reviews.slice(0, 5).map(r => (
                  <div key={r.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 16px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.87rem", color: "#1A1A2E" }}>{r.reviewerName}</span>
                      <span style={{ color: "#f59e0b", fontSize: "0.9rem", letterSpacing: "0.05em" }}>
                        {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#4A4A6A", lineHeight: 1.6 }}>{r.text}</p>
                  </div>
                ))}
              </div>
            )}
            {business.reviews.length === 0 && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <button
                  onClick={() => { setReviewModalOpen(true); setReviewDone(false); setReviewError(null); setReviewForm({ reviewerName: "", text: "", rating: 5 }); }}
                  style={{ background: "none", border: "1.5px solid #e8eaf0", borderRadius: 10, padding: "8px 20px", fontSize: "0.85rem", color: "#4A4A6A", cursor: "pointer", fontWeight: 600 }}
                >
                  ⭐ Dejar un testimonio
                </button>
              </div>
            )}

            {business.services.length === 0 ? (
              <div className={styles.emptyMsg}>
                Este negocio no tiene servicios disponibles por el momento.
              </div>
            ) : (
              <div className={styles.serviceList}>
                {business.services.map((service) => (
                  <button
                    key={service.id}
                    className={styles.serviceCard}
                    onClick={() => {
                      setSelectedService(service);
                      setSelectedDate("");
                      setDateError(null);
                      setSlots([]);
                      setNoSlots(false);
                      setSelectedSlot(null);
                      setStep(2);
                    }}
                  >
                    <div className={styles.serviceCardLeft}>
                      <span className={styles.serviceName}>{service.name}</span>
                      {service.description && (
                        <span className={styles.serviceDesc}>{service.description}</span>
                      )}
                      <span className={styles.serviceDuration}>
                        ⏱ {service.duration} min
                      </span>
                    </div>
                    <div className={styles.serviceCardRight}>
                      <span className={styles.servicePrice}>
                        {formatPrice(service.price)}
                      </span>
                      <span className={styles.serviceArrow}>→</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======== STEP 2 — Elegir fecha y horario ======== */}
        {step === 2 && selectedService && (
          <div>
            <button className={styles.backBtn} onClick={() => setStep(1)}>
              ← Cambiar servicio
            </button>
            <h2 className={styles.stepTitle}>Elegí fecha y horario</h2>
            <div className={styles.selectedServiceTag}>
              <span>{selectedService.name}</span>
              <span className={styles.selectedServiceDuration}>
                ⏱ {selectedService.duration} min · {formatPrice(selectedService.price)}
              </span>
            </div>

            {submitError && (
              <div className={styles.errorMsg}>{submitError}</div>
            )}

            <div className={styles.card}>
              <label className={styles.inputLabel} htmlFor="booking-date">
                Fecha
              </label>
              <input
                id="booking-date"
                type="date"
                className={styles.dateInput}
                min={todayISO()}
                value={selectedDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) { setDateError(null); setDayClosedError(false); setSelectedDate(""); return; }
                  setSelectedDate(val);
                  if (val < todayISO()) {
                    setDateError("No podés reservar para una fecha pasada.");
                    setDayClosedError(false);
                    setSlots([]); setNoSlots(false); setSelectedSlot(null);
                    return;
                  }
                  const [dy, dm, dd] = val.split("-").map(Number);
                  const jsDay = new Date(dy, dm - 1, dd).getDay();
                  const dayEnum = JS_DAY_TO_ENUM[jsDay];
                  if (!activeDays.has(dayEnum)) {
                    setDateError("El negocio no atiende ese día.");
                    setDayClosedError(true);
                    setSlots([]); setNoSlots(false); setSelectedSlot(null);
                    return;
                  }
                  setDateError(null);
                  setDayClosedError(false);
                  setSubmitError(null);
                }}
              />
              {dateError && (
                <div className={styles.errorMsg} style={{ marginTop: 10, marginBottom: 0 }}>
                  {dateError}
                </div>
              )}

              {availSummary && (
                <div className={styles.availSummary}>
                  Atiende: {availSummary}
                </div>
              )}

              {selectedDate && !dateError && (
                <div style={{ marginTop: 24 }}>
                  <div className={styles.slotsLabel}>
                    Horarios disponibles — {formatDate(selectedDate)}
                  </div>

                  {slotsLoading && (
                    <div className={styles.slotGrid}>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={styles.slotSkeleton} />
                      ))}
                    </div>
                  )}

                  {!slotsLoading && blockedReason && (
                    <div className={styles.blockedMsg}>
                      {blockedReason}
                    </div>
                  )}

                  {!slotsLoading && noSlots && (
                    <div className={styles.noSlotsMsg}>
                      No hay turnos disponibles para este día. Probá con otra fecha.
                    </div>
                  )}

                  {!slotsLoading && slots.length > 0 && (
                    <div className={styles.slotGrid}>
                      {slots.map((slot) => (
                        <button
                          key={slot}
                          className={[
                            styles.slot,
                            selectedSlot === slot ? styles.slotSelected : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => {
                            setSelectedSlot(slot);
                            setStep(3);
                            setSubmitError(null);
                          }}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======== STEP 3 — Datos del cliente ======== */}
        {step === 3 && selectedService && selectedSlot && selectedDate && (
          <div>
            <button
              className={styles.backBtn}
              onClick={() => {
                setStep(2);
                setSubmitError(null);
              }}
            >
              ← Cambiar horario
            </button>
            <h2 className={styles.stepTitle}>Confirmá tu reserva</h2>

            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Negocio</span>
                <span className={styles.summaryVal}>{business.name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Servicio</span>
                <span className={styles.summaryVal}>{selectedService.name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Fecha</span>
                <span className={styles.summaryVal}>{formatDate(selectedDate)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Hora</span>
                <span className={styles.summaryVal}>{selectedSlot} hs</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Precio</span>
                <span className={styles.summaryVal}>
                  {formatPrice(selectedService.price)}
                </span>
              </div>
            </div>

            <form className={styles.card} onSubmit={handleSubmit} noValidate>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel} htmlFor="clientName">
                  Tu nombre completo *
                </label>
                <input
                  id="clientName"
                  type="text"
                  className={styles.inputField}
                  placeholder="Ej: Juan Pérez"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.inputLabel} htmlFor="clientWhatsapp">
                  Tu WhatsApp *
                </label>
                <input
                  id="clientWhatsapp"
                  type="tel"
                  className={styles.inputField}
                  placeholder="Ej: 0981123456"
                  value={clientWhatsapp}
                  onChange={(e) =>
                    setClientWhatsapp(e.target.value.replace(/\D/g, ""))
                  }
                  required
                  minLength={7}
                  maxLength={15}
                  autoComplete="tel"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.inputLabel} htmlFor="notes">
                  Notas para el negocio (opcional)
                </label>
                <textarea
                  id="notes"
                  className={`${styles.inputField} ${styles.textarea}`}
                  placeholder="Ej: Primera vez, prefiero corte bajo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {submitError && (
                <div className={styles.errorMsg}>{submitError}</div>
              )}

              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={
                  submitting ||
                  !clientName.trim() ||
                  clientWhatsapp.length < 7
                }
              >
                {submitting ? "Confirmando..." : "Confirmar reserva →"}
              </button>
            </form>
          </div>
        )}

        {/* ======== SUCCESS ======== */}
        {step === "success" && bookingResult && (
          <div className={styles.successCard}>
            <div className={styles.checkCircle}>✓</div>
            <h2 className={styles.successTitle}>¡Reserva confirmada!</h2>
            <p className={styles.successSub}>
              Te esperamos el{" "}
              <strong>{formatDate(selectedDate)}</strong>
              <br />a las <strong>{selectedSlot} hs</strong>
            </p>

            <div className={styles.summaryBox} style={{ margin: "24px 0", textAlign: "left", background: "#FFFFFF" }}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Negocio</span>
                <span className={styles.summaryVal}>{business.name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Servicio</span>
                <span className={styles.summaryVal}>{bookingResult.service.name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Horario</span>
                <span className={styles.summaryVal}>
                  {bookingResult.startTime} – {bookingResult.endTime} hs
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Estado</span>
                <span className={styles.statusBadge}>Pendiente de confirmación</span>
              </div>
            </div>

            <div className={styles.successActions}>
              {business.whatsapp && (
                <a
                  href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
                    `Hola! Acabo de reservar un turno para el ${formatDate(selectedDate)} a las ${selectedSlot} hs. 🗓️`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.whatsappBtn}
                >
                  💬 Contactar por WhatsApp
                </a>
              )}
              <button className={styles.btnOutlineLight} onClick={resetWizard}>
                Hacer otra reserva
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </main>
      {step !== "success" && (
        <>
          <div className={styles.myBookingsBar}>
            <button className={styles.myBookingsBtn} onClick={() => { setMyBookingsOpen(true); setMyBookings(null); setMyBookingsWa(""); setMyBookingsError(null); }}>
              Ver mis reservas
            </button>
          </div>
          <Footer />
        </>
      )}

      {/* ---- REVIEW MODAL ---- */}
      {reviewModalOpen && (
        <div className={styles.modalOverlay} onClick={() => !reviewSubmitting && setReviewModalOpen(false)}>
          <div className={styles.myBookingsModal} onClick={e => e.stopPropagation()}>
            <div className={styles.myBookingsModalHeader}>
              <h3 className={styles.myBookingsModalTitle}>Dejar un testimonio</h3>
              <button className={styles.myBookingsClose} onClick={() => setReviewModalOpen(false)}>✕</button>
            </div>
            {reviewDone ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🙏</div>
                <p style={{ fontWeight: 700, color: "#1A1A2E", marginBottom: 6 }}>¡Gracias por tu opinión!</p>
                <p style={{ fontSize: "0.85rem", color: "#4A4A6A" }}>Tu testimonio será visible una vez que sea aprobado.</p>
                <button
                  className={styles.myBookingsSearchBtn}
                  style={{ marginTop: 16 }}
                  onClick={() => setReviewModalOpen(false)}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} style={{ padding: "4px 0" }}>
                <p className={styles.myBookingsModalSub}>Tu opinión ayuda a otros clientes a elegir</p>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#4A4A6A", display: "block", marginBottom: 5 }}>Tu nombre *</label>
                  <input
                    type="text"
                    className={styles.myBookingsInput}
                    placeholder="Ej: Juan Pérez"
                    value={reviewForm.reviewerName}
                    onChange={e => setReviewForm(f => ({ ...f, reviewerName: e.target.value }))}
                    required
                    maxLength={100}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#4A4A6A", display: "block", marginBottom: 5 }}>Calificación *</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReviewForm(f => ({ ...f, rating: n }))}
                        style={{
                          fontSize: "1.6rem",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: n <= reviewForm.rating ? "#f59e0b" : "#d1d5db",
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#4A4A6A", display: "block", marginBottom: 5 }}>Tu testimonio *</label>
                  <textarea
                    className={styles.myBookingsInput}
                    style={{ resize: "vertical", minHeight: 80 }}
                    placeholder="Contá tu experiencia (mínimo 10 caracteres)"
                    value={reviewForm.text}
                    onChange={e => setReviewForm(f => ({ ...f, text: e.target.value }))}
                    required
                    minLength={10}
                    maxLength={500}
                    rows={3}
                  />
                  <span style={{ fontSize: "0.75rem", color: "#8888aa" }}>{reviewForm.text.length}/500</span>
                </div>

                {reviewError && <div className={styles.myBookingsError}>{reviewError}</div>}

                <div className={styles.myBookingsSearch}>
                  <button
                    type="submit"
                    className={styles.myBookingsSearchBtn}
                    style={{ width: "100%" }}
                    disabled={reviewSubmitting || !reviewForm.reviewerName.trim() || reviewForm.text.trim().length < 10}
                  >
                    {reviewSubmitting ? "Enviando..." : "Enviar testimonio"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {myBookingsOpen && (
        <div className={styles.modalOverlay} onClick={() => setMyBookingsOpen(false)}>
          <div className={styles.myBookingsModal} onClick={e => e.stopPropagation()}>
            <div className={styles.myBookingsModalHeader}>
              <h3 className={styles.myBookingsModalTitle}>Mis reservas activas</h3>
              <button className={styles.myBookingsClose} onClick={() => setMyBookingsOpen(false)}>✕</button>
            </div>
            <p className={styles.myBookingsModalSub}>Ingresá el WhatsApp con el que reservaste</p>
            <div className={styles.myBookingsSearch}>
              <input
                type="tel"
                className={styles.myBookingsInput}
                placeholder="Ej: 0981123456"
                value={myBookingsWa}
                onChange={e => { setMyBookingsWa(e.target.value.replace(/\D/g, "")); setMyBookings(null); setMyBookingsError(null); }}
                onKeyDown={e => e.key === "Enter" && fetchMyBookings()}
                maxLength={15}
              />
              <button className={styles.myBookingsSearchBtn} onClick={fetchMyBookings} disabled={myBookingsLoading}>
                {myBookingsLoading ? "..." : "Buscar"}
              </button>
            </div>
            {myBookingsError && <div className={styles.myBookingsError}>{myBookingsError}</div>}
            {myBookings !== null && myBookings.length === 0 && (
              <div className={styles.myBookingsEmpty}>No tenés reservas activas en este negocio.</div>
            )}
            {myBookings && myBookings.length > 0 && (
              <div className={styles.myBookingsList}>
                {myBookings.map(b => (
                  <div key={b.id} className={styles.myBookingItem}>
                    <div className={styles.myBookingDate}>{formatDate(b.date.split("T")[0])}</div>
                    <div className={styles.myBookingTime}>{b.startTime} – {b.endTime} hs</div>
                    <div className={styles.myBookingService}>{b.service.name}{b.service.price != null ? ` · ${formatPrice(b.service.price)}` : ""}</div>
                    <span className={styles.myBookingStatus}>{b.status === "PENDING" ? "Pendiente" : "Confirmado"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
