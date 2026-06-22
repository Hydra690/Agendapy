"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import styles from "./booking.module.css";
import { formatPrice, formatDate, todayISO } from "./format";
import ReviewModal from "./ReviewModal";
import MyBookingsModal from "./MyBookingsModal";

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

interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  serviceIds: string[];   // servicios que realiza; vacío = todos
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
  staff: StaffMember[];
  reviews: Review[];
}

interface BookingResult {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  manageToken: string | null;
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
// formatPrice / formatDate / todayISO viven en ./format (compartidos con los modales).

function isDotDone(current: 1 | 2 | 3 | "success", dot: 1 | 2 | 3): boolean {
  if (current === "success") return true;
  return (current as number) > dot;
}

// ---- Sub-components ----

function Navbar() {
  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.navLogo}>
        agenda<span className={styles.navLogoAccent}>py</span>
      </Link>
    </nav>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <Link href="/" className={styles.footerLink}>
        Powered by <strong>agendapy</strong>
      </Link>
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
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [noSlots, setNoSlots] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null); // null = cualquiera

  // Modales: solo el flag de apertura; su estado interno vive en cada componente.
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [myBookingsOpen, setMyBookingsOpen] = useState(false);

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
        const staffQuery = selectedStaffId ? `&staffId=${selectedStaffId}` : "";
        const res = await fetch(
          `/api/${slug}/slots?date=${date}&serviceId=${selectedService.id}${staffQuery}`
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
    [slug, selectedService, selectedStaffId]
  );

  useEffect(() => {
    // Carga de slots al entrar al paso 2 / cambiar fecha o profesional (fetch-on-mount).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (step === 2 && selectedDate && !dateError) fetchSlots(selectedDate);
  }, [step, selectedDate, dateError, fetchSlots]);

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
          staffId: selectedStaffId ?? undefined,
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

  function resetWizard() {
    setStep(1);
    setSelectedService(null);
    setSelectedDate("");
    setDateError(null);
    setSlots([]);
    setNoSlots(false);
    setBlockedReason(null);
    setSelectedSlot(null);
    setSelectedStaffId(null);
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

  // Profesionales que pueden hacer el servicio elegido (vacío de serviceIds = todos).
  const eligibleStaff = (business?.staff ?? []).filter(
    (s) => selectedService != null && (s.serviceIds.length === 0 || s.serviceIds.includes(selectedService.id))
  );

  const staffChip = (on: boolean): React.CSSProperties => ({
    border: `1.5px solid ${on ? "#00C48C" : "#E8EAF0"}`,
    background: on ? "#E8FFF6" : "#fff",
    color: on ? "#0f7a55" : "#4A4A6A",
    borderRadius: 99, padding: "7px 14px", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
  });

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
            {/* URL remota arbitraria provista por el dueño: next/image exigiría
                remotePatterns con wildcard (vector SSRF + costo). <img> es lo correcto. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
            // eslint-disable-next-line @next/next/no-img-element -- URL remota arbitraria del dueño (ver nota en cover)
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
                    onClick={() => setReviewModalOpen(true)}
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
                  onClick={() => setReviewModalOpen(true)}
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
                      setSelectedStaffId(null);
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

            {eligibleStaff.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1A1A2E", marginBottom: 8 }}>
                  Profesional
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" onClick={() => setSelectedStaffId(null)} style={staffChip(selectedStaffId === null)}>
                    Cualquiera disponible
                  </button>
                  {eligibleStaff.map((s) => (
                    <button key={s.id} type="button" onClick={() => setSelectedStaffId(s.id)} style={staffChip(selectedStaffId === s.id)}>
                      {s.name}{s.role ? ` · ${s.role}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                  if (!val) { setDateError(null); setSelectedDate(""); return; }
                  setSelectedDate(val);
                  if (val < todayISO()) {
                    setDateError("No podés reservar para una fecha pasada.");
                    setSlots([]); setNoSlots(false); setSelectedSlot(null);
                    return;
                  }
                  const [dy, dm, dd] = val.split("-").map(Number);
                  const jsDay = new Date(dy, dm - 1, dd).getDay();
                  const dayEnum = JS_DAY_TO_ENUM[jsDay];
                  if (!activeDays.has(dayEnum)) {
                    setDateError("El negocio no atiende ese día.");
                    setSlots([]); setNoSlots(false); setSelectedSlot(null);
                    return;
                  }
                  setDateError(null);
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

            {bookingResult.manageToken && (
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", marginBottom: 18, textAlign: "center" }}>
                <p style={{ color: "#cfd2e0", fontSize: "0.82rem", margin: "0 0 10px", lineHeight: 1.5 }}>
                  Guardá este link para ver o cancelar tu reserva más tarde:
                </p>
                <a
                  href={`/turno/${bookingResult.manageToken}`}
                  style={{ display: "inline-block", color: "#00C48C", fontWeight: 700, textDecoration: "none", fontSize: "0.9rem" }}
                >
                  Gestionar mi reserva →
                </a>
              </div>
            )}

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
            <button className={styles.myBookingsBtn} onClick={() => setMyBookingsOpen(true)}>
              Ver mis reservas
            </button>
          </div>
          <Footer />
        </>
      )}

      {reviewModalOpen && <ReviewModal slug={slug} onClose={() => setReviewModalOpen(false)} />}

      {myBookingsOpen && <MyBookingsModal slug={slug} onClose={() => setMyBookingsOpen(false)} />}
    </div>
  );
}
