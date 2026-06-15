"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

// ---- Types ----

interface Business {
  id: string;
  name: string;
  slug: string;
  category: string;
  whatsapp: string | null;
  logoUrl: string | null;
  plan: string;
  planExpiry: string | null;
  trialEndsAt: string | null;
  _count: { services: number; availability: number; bookings: number };
}

function hasAccess(business: Business): boolean {
  const now = new Date();
  if (business.plan !== "FREE" && business.planExpiry && new Date(business.planExpiry) > now) return true;
  if (business.trialEndsAt && new Date(business.trialEndsAt) > now) return true;
  return false;
}

interface BookingClient { name: string; whatsapp: string | null; }
interface BookingService { name: string; duration: number; price: number | null; }

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  client: BookingClient;
  service: BookingService;
}

// ---- Helpers ----

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatPrice(price: number | null): string {
  if (price === null) return "A consultar";
  return `Gs. ${new Intl.NumberFormat("es-PY").format(price)}`;
}

function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PY", {
    weekday: "long", day: "numeric", month: "long",
  });
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente", CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado", COMPLETED: "Completado", NO_SHOW: "No asistió",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: styles.statusPending, CONFIRMED: styles.statusConfirmed,
  CANCELLED: styles.statusCancelled, COMPLETED: styles.statusCompleted, NO_SHOW: styles.statusNoShow,
};

// ---- Calendar ----

const DOW_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const totalDays = new Date(year, month, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  return { totalDays, startOffset };
}

// ---- Extra types ----

interface Stats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  estimatedRevenue: number;
  topService: string | null;
  busiestHour: string | null;
  weekRevenue: number;
  prevWeekRevenue: number;
  lostClients: number;
}

type WeekBooking = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  client: { name: string; whatsapp: string | null };
  service: { name: string; duration: number; price: number | null };
};

// ---- Page ----

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [business, setBusiness] = useState<Business | null>(null);
  const [bizLoading, setBizLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1);
  const [datesWithBookings, setDatesWithBookings] = useState<Set<string>>(new Set());

  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [weekDays, setWeekDays] = useState<Record<string, WeekBooking[]> | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [blockedDatesMap, setBlockedDatesMap] = useState<Map<string, string | null>>(new Map());
  const [cancelModal, setCancelModal] = useState<{
    open: boolean;
    booking: Booking | null;
    reason: string;
    done: boolean;
  }>({ open: false, booking: null, reason: "", done: false });

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch("/api/dashboard/business")
      .then(r => {
        if (r.status === 404) { router.push("/onboarding"); return null; }
        return r.json() as Promise<{ business: Business }>;
      })
      .then(data => { if (data) setBusiness(data.business); })
      .catch(console.error)
      .finally(() => setBizLoading(false));
  }, [authStatus, router]);

  const loadMonthDates = useCallback(async (year: number, month: number) => {
    try {
      const res = await fetch(`/api/dashboard/bookings/month?year=${year}&month=${month}`);
      const data = await res.json() as { dates: string[] };
      setDatesWithBookings(new Set(data.dates ?? []));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") loadMonthDates(calYear, calMonth);
  }, [authStatus, calYear, calMonth, loadMonthDates]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch(`/api/dashboard/stats?year=${calYear}&month=${calMonth}`)
      .then(r => r.json() as Promise<Stats>)
      .then(setStats)
      .catch(() => {});
  }, [authStatus, calYear, calMonth]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch("/api/dashboard/blocked-dates")
      .then(r => r.json() as Promise<{ blockedDates: Array<{ date: string; reason: string | null }> }>)
      .then(data => {
        const map = new Map<string, string | null>();
        for (const b of data.blockedDates ?? []) {
          map.set(b.date.split("T")[0], b.reason);
        }
        setBlockedDatesMap(map);
      })
      .catch(() => {});
  }, [authStatus]);

  const loadBookings = useCallback(async (date: string) => {
    setBookingsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/bookings?date=${date}`);
      const data = await res.json() as { bookings: Booking[] };
      setBookings(data.bookings ?? []);
    } catch {
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated" && selectedDate) loadBookings(selectedDate);
  }, [authStatus, selectedDate, loadBookings]);

  async function patchStatus(bookingId: string, newStatus: string) {
    if (!business) return;
    setActionLoading(bookingId);
    try {
      await fetch(`/api/${business.slug}/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      await loadBookings(selectedDate);
      await loadMonthDates(calYear, calMonth);
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  }

  function getWeekStart(isoDate: string): string {
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dow = (date.getDay() + 6) % 7; // 0=Mon
    const mon = new Date(y, m - 1, d - dow);
    return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
  }

  const loadWeek = useCallback(async (weekStart: string) => {
    setWeekLoading(true);
    try {
      const res = await fetch(`/api/dashboard/bookings/week?startDate=${weekStart}`);
      const data = await res.json() as { days: Record<string, WeekBooking[]> };
      setWeekDays(data.days ?? null);
    } catch {
      setWeekDays(null);
    } finally {
      setWeekLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "week" && authStatus === "authenticated") {
      loadWeek(getWeekStart(selectedDate));
    }
  }, [viewMode, selectedDate, authStatus, loadWeek]);

  function prevMonth() {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  }

  const today = todayISO();
  const { totalDays, startOffset } = buildCalendarDays(calYear, calMonth);
  const monthLabel = new Date(calYear, calMonth - 1, 1).toLocaleDateString("es-PY", {
    month: "long", year: "numeric",
  });

  if (authStatus === "loading" || bizLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60dvh" }}>
        <div style={{ color: "#4A4A6A", fontSize: "0.9rem" }}>Cargando...</div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.contentHeader} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className={styles.contentTitle}>
            Hola, {session?.user?.name?.split(" ")[0] ?? "dueño"} 👋
          </h1>
          <p className={styles.contentSub}>Panel de reservas</p>
        </div>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === "day" ? styles.viewToggleBtnActive : ""}`}
            onClick={() => setViewMode("day")}
          >Día</button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === "week" ? styles.viewToggleBtnActive : ""}`}
            onClick={() => setViewMode("week")}
          >Semana</button>
        </div>
      </div>

      {business && (
        <div className={styles.linkBanner}>
          <span className={styles.linkBannerLabel}>Tu link de reservas</span>
          <span className={styles.linkUrl}>agendapy.com/{business.slug}</span>
          <div className={styles.linkBannerBtns}>
            <button
              className={styles.btnCopyLink}
              onClick={() => {
                navigator.clipboard.writeText(`agendapy.com/${business.slug}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "¡Copiado!" : "Copiar link"}
            </button>
            <button
              className={styles.btnCopyLink}
              style={{ background: "#25D366", color: "#fff" }}
              onClick={() => {
                const msg = `¡Hola! Reservá tu turno en ${business.name} directo desde tu celular: https://agendapy.com/${business.slug} 📅`;
                navigator.clipboard.writeText(msg);
                setCopiedWa(true);
                setTimeout(() => setCopiedWa(false), 2500);
              }}
            >
              {copiedWa ? "¡Copiado!" : "💬 Copiar para WA"}
            </button>
            <a
              href={`/${business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.btnOpenPage}
            >
              Ver página ↗
            </a>
          </div>
        </div>
      )}

      {business && !hasAccess(business) && (
        <div style={{
          background: "#fff8e1",
          border: "1.5px solid #ffe082",
          borderRadius: 12,
          padding: "12px 18px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <div>
            <span style={{ fontWeight: 700, color: "#b45309", fontSize: "0.88rem" }}>
              Tu período de prueba venció.
            </span>
            <span style={{ color: "#92400e", fontSize: "0.84rem", marginLeft: 6 }}>
              Algunas funciones (export CSV, recordatorios) están deshabilitadas.
            </span>
          </div>
          <a
            href="mailto:hola@agendapy.com?subject=Quiero contratar el plan"
            style={{
              background: "#f59e0b",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.82rem",
              borderRadius: 8,
              padding: "6px 16px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Contratar plan
          </a>
        </div>
      )}

      {/* ---- CHECKLIST ONBOARDING ---- */}
      {business && (() => {
        const steps = [
          { label: "Creaste tu negocio", done: true },
          { label: "Agregá tu primer servicio", done: business._count.services > 0, link: "/dashboard/services" },
          { label: "Subí tu logo", done: !!business.logoUrl, link: "/dashboard/settings" },
          { label: "Configurá tus horarios", done: business._count.availability > 0, link: "/dashboard/settings" },
          { label: "Recibí tu primera reserva", done: business._count.bookings > 0 },
        ];
        const allDone = steps.every(s => s.done);
        if (allDone) return null;
        const doneCount = steps.filter(s => s.done).length;
        return (
          <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 14, marginBottom: 16, overflow: "hidden" }}>
            <button
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "none", border: "none", cursor: "pointer", gap: 12 }}
              onClick={() => setChecklistOpen(o => !o)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, color: "#1A1A2E", fontSize: "0.9rem" }}>Primeros pasos</span>
                <span style={{ fontSize: "0.78rem", color: "#00c48c", fontWeight: 700, background: "#e8fff6", borderRadius: 99, padding: "2px 10px" }}>
                  {doneCount}/{steps.length}
                </span>
              </div>
              <span style={{ color: "#8888aa", fontSize: "0.85rem" }}>{checklistOpen ? "▲" : "▼"}</span>
            </button>
            {checklistOpen && (
              <div style={{ borderTop: "1px solid #f0f2f8", padding: "12px 18px 16px" }}>
                {steps.map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: step.done ? "#00c48c" : "#f0f2f8",
                      color: step.done ? "#fff" : "#8888aa",
                      fontSize: "0.75rem", fontWeight: 700,
                    }}>
                      {step.done ? "✓" : i + 1}
                    </span>
                    {step.link && !step.done ? (
                      <a href={step.link} style={{ color: "#1A1A2E", fontSize: "0.86rem", textDecoration: "none", fontWeight: 500 }}>
                        {step.label} →
                      </a>
                    ) : (
                      <span style={{ color: step.done ? "#6b7280" : "#1A1A2E", fontSize: "0.86rem", textDecoration: step.done ? "line-through" : "none", fontWeight: step.done ? 400 : 500 }}>
                        {step.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {stats && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#4a4a6a", textTransform: "capitalize" }}>
            {monthLabel}
          </span>
          {business && hasAccess(business) ? (
            <a
              href={`/api/dashboard/export?year=${calYear}&month=${calMonth}`}
              download
              style={{ fontSize: "0.8rem", fontWeight: 700, color: "#4a4a6a", border: "1.5px solid #e8eaf0", borderRadius: 8, padding: "5px 14px", textDecoration: "none", background: "#fff", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#00c48c"; (e.currentTarget as HTMLAnchorElement).style.color = "#009e71"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#e8eaf0"; (e.currentTarget as HTMLAnchorElement).style.color = "#4a4a6a"; }}
            >
              ↓ Exportar CSV
            </a>
          ) : (
            <span
              title="El export de CSV requiere un plan activo."
              style={{ fontSize: "0.8rem", fontWeight: 700, color: "#b0b3c1", border: "1.5px solid #e8eaf0", borderRadius: 8, padding: "5px 14px", background: "#f7f8fb", cursor: "not-allowed" }}
            >
              ↓ Exportar CSV 🔒
            </span>
          )}
        </div>
      )}
      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Turnos este mes</div>
            <div className={`${styles.statValue} ${styles.statAccent}`}>{stats.total}</div>
            <div className={styles.statSub}>{stats.pending} pendientes · {stats.confirmed} confirmados</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Completados</div>
            <div className={`${styles.statValue} ${styles.statMuted}`}>{stats.completed}</div>
            <div className={styles.statSub}>de {stats.total} en total</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Cancelados</div>
            <div className={`${styles.statValue} ${styles.statDanger}`}>{stats.cancelled}</div>
            <div className={styles.statSub}>{stats.total > 0 ? Math.round((stats.cancelled / stats.total) * 100) : 0}% del total</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Ingresos estimados</div>
            <div className={`${styles.statValue} ${styles.statAccent}`} style={{ fontSize: stats.estimatedRevenue > 9999999 ? "1.1rem" : "1.7rem" }}>
              {stats.estimatedRevenue === 0 ? "—" : `Gs. ${new Intl.NumberFormat("es-PY").format(stats.estimatedRevenue)}`}
            </div>
            <div className={styles.statSub}>confirmados + completados</div>
          </div>
        </div>
      )}

      {/* ---- INSIGHTS ---- */}
      {stats && (stats.topService || stats.busiestHour || stats.lostClients > 0 || stats.weekRevenue > 0 || stats.prevWeekRevenue > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
          {(stats.weekRevenue > 0 || stats.prevWeekRevenue > 0) && (
            <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: "0.76rem", color: "#8888aa", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Esta semana</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#00c48c" }}>
                {stats.weekRevenue === 0 ? "Gs. 0" : `Gs. ${new Intl.NumberFormat("es-PY").format(stats.weekRevenue)}`}
              </div>
              {stats.prevWeekRevenue > 0 && (
                <div style={{ fontSize: "0.78rem", color: stats.weekRevenue >= stats.prevWeekRevenue ? "#00c48c" : "#ef4444", marginTop: 2 }}>
                  {stats.weekRevenue >= stats.prevWeekRevenue ? "▲" : "▼"} vs semana anterior: Gs. {new Intl.NumberFormat("es-PY").format(stats.prevWeekRevenue)}
                </div>
              )}
            </div>
          )}
          {stats.topService && (
            <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: "0.76rem", color: "#8888aa", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Servicio más popular</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1A1A2E" }}>{stats.topService}</div>
              <div style={{ fontSize: "0.78rem", color: "#8888aa", marginTop: 2 }}>este mes</div>
            </div>
          )}
          {stats.busiestHour && (
            <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: "0.76rem", color: "#8888aa", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hora más concurrida</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1A1A2E" }}>{stats.busiestHour} hs</div>
              <div style={{ fontSize: "0.78rem", color: "#8888aa", marginTop: 2 }}>este mes</div>
            </div>
          )}
          {stats.lostClients > 0 && (
            <div style={{ background: "#fff", border: "1.5px solid #ffe082", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: "0.76rem", color: "#b45309", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sin reservar en 30+ días</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#b45309" }}>{stats.lostClients}</div>
              <a href="/dashboard/clients" style={{ fontSize: "0.78rem", color: "#b45309", marginTop: 2, display: "block" }}>Ver clientes →</a>
            </div>
          )}
        </div>
      )}

      {/* ---- WEEK VIEW ---- */}
      {viewMode === "week" && (
        <div className={styles.weekView}>
          {weekLoading && <div style={{ color: "#4a4a6a", fontSize: "0.9rem", padding: "20px 0" }}>Cargando semana...</div>}
          {!weekLoading && weekDays && Object.entries(weekDays).map(([date, dayBookings]) => {
            const [dy, dm, dd] = date.split("-").map(Number);
            const dayName = new Date(dy, dm - 1, dd).toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" });
            const isToday = date === today;
            return (
              <div key={date} className={styles.weekDayCard}>
                <div className={`${styles.weekDayHeader} ${dayBookings.length > 0 ? styles.weekDayHeaderActive : ""}`}>
                  <div>
                    <div className={styles.weekDayName} style={isToday ? { color: "#00c48c" } : {}}>
                      {isToday ? "Hoy — " : ""}{dayName}
                    </div>
                  </div>
                  <span className={`${styles.weekDayCount} ${dayBookings.length === 0 ? styles.weekDayCountZero : ""}`}>
                    {dayBookings.length} turno{dayBookings.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {dayBookings.length === 0 ? (
                  <div className={styles.weekDayEmpty}>Sin turnos</div>
                ) : (
                  <div className={styles.weekDayBookings}>
                    {dayBookings.map(b => (
                      <div key={b.id} className={styles.weekBookingRow}>
                        <div className={styles.weekBookingTime}>{b.startTime} – {b.endTime}</div>
                        <div className={styles.weekBookingInfo}>
                          <div className={styles.weekBookingClient}>👤 {b.client.name}</div>
                          <div className={styles.weekBookingService}>{b.service.name} · {b.service.duration} min</div>
                        </div>
                        <span className={`${styles.statusBadge} ${STATUS_CLASS[b.status] ?? ""}`}>
                          {STATUS_LABEL[b.status] ?? b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---- DAY VIEW ---- */}
      {viewMode === "day" && <div className={styles.mainGrid}>

        {/* ---- CALENDAR ---- */}
        <div className={styles.calendarCard}>
          <div className={styles.calendarNav}>
            <button className={styles.calendarNavBtn} onClick={prevMonth}>‹</button>
            <span className={styles.calendarMonth}>{monthLabel}</span>
            <button className={styles.calendarNavBtn} onClick={nextMonth}>›</button>
          </div>

          <div className={styles.calendarGrid}>
            {DOW_LABELS.map(d => (
              <div key={d} className={styles.calendarDow}>{d}</div>
            ))}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`e-${i}`} className={styles.calendarDayEmpty} />
            ))}
            {Array.from({ length: totalDays }, (_, i) => {
              const day = i + 1;
              const iso = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isPast = iso < today;
              const isSelected = iso === selectedDate;
              const hasDot = datesWithBookings.has(iso);
              const isBlocked = blockedDatesMap.has(iso);
              return (
                <button
                  key={iso}
                  className={[
                    styles.calendarDay,
                    isSelected ? styles.calendarDaySelected : "",
                    isPast ? styles.calendarDayPast : "",
                    isBlocked && !isSelected ? styles.calendarDayBlocked : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => !isPast && setSelectedDate(iso)}
                  disabled={isPast}
                  title={isBlocked ? (blockedDatesMap.get(iso) ?? "Día bloqueado") : undefined}
                >
                  {day}
                  {hasDot && <span className={styles.calendarDot} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- BOOKINGS PANEL ---- */}
        <div className={styles.bookingsPanel}>
          <div className={styles.bookingsHeader}>
            <h2 className={styles.bookingsTitle}>{formatDateLong(selectedDate)}</h2>
            <span className={styles.bookingsCount}>
              {!bookingsLoading && `${bookings.length} turno${bookings.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {blockedDatesMap.has(selectedDate) && (
            <div className={styles.blockedNotice}>
              🚫 Día bloqueado
              {blockedDatesMap.get(selectedDate) && ` — ${blockedDatesMap.get(selectedDate)}`}
            </div>
          )}

          {bookingsLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ background: "#f5f7fa", borderRadius: 12, padding: 18 }}>
                  <div className={styles.skeletonLine} style={{ height: 16, width: "40%", marginBottom: 10 }} />
                  <div className={styles.skeletonLine} style={{ height: 13, width: "65%" }} />
                </div>
              ))}
            </div>
          )}

          {!bookingsLoading && bookings.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📭</div>
              <div className={styles.emptyTitle}>Sin turnos para este día</div>
              <p className={styles.emptyMsg}>Los turnos de tus clientes aparecerán acá.</p>
            </div>
          )}

          {!bookingsLoading && bookings.map(b => {
            const busy = actionLoading === b.id;
            return (
              <div key={b.id} className={styles.bookingCard}>
                <div className={styles.bookingTop}>
                  <div>
                    <div className={styles.bookingTime}>{b.startTime} – {b.endTime} hs</div>
                    <div className={styles.bookingService}>
                      {b.service.name} · {b.service.duration} min · {formatPrice(b.service.price)}
                    </div>
                  </div>
                  <span className={`${styles.statusBadge} ${STATUS_CLASS[b.status] ?? ""}`}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>

                <div className={styles.bookingClient}>
                  <div className={styles.bookingClientName}>👤 {b.client.name}</div>
                  {b.client.whatsapp && (
                    <a href={`https://wa.me/${b.client.whatsapp}`} target="_blank" rel="noopener noreferrer" className={styles.bookingWhatsapp}>
                      💬 {b.client.whatsapp}
                    </a>
                  )}
                </div>

                {b.notes && <div className={styles.bookingNotes}>📝 {b.notes}</div>}

                {b.status === "PENDING" && (
                  <div className={styles.bookingActions}>
                    <button className={styles.btnConfirm} disabled={busy} onClick={() => patchStatus(b.id, "CONFIRMED")}>
                      {busy ? "..." : "✓ Confirmar"}
                    </button>
                    <button className={styles.btnCancel} disabled={busy} onClick={() => setCancelModal({ open: true, booking: b, reason: "", done: false })}>
                      ✕ Cancelar
                    </button>
                  </div>
                )}

                {b.status === "CONFIRMED" && (
                  <div className={styles.bookingActions}>
                    <button className={styles.btnComplete} disabled={busy} onClick={() => patchStatus(b.id, "COMPLETED")}>
                      {busy ? "..." : "✓ Marcar como completado"}
                    </button>
                    <button className={styles.btnCancel} disabled={busy} onClick={() => setCancelModal({ open: true, booking: b, reason: "", done: false })}>
                      ✕ Cancelar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>}

      {/* ---- CANCEL MODAL ---- */}
      {cancelModal.open && cancelModal.booking && (
        <div
          className={styles.modalOverlay}
          onClick={() => !cancelModal.done && setCancelModal(m => ({ ...m, open: false }))}
        >
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            {cancelModal.done ? (
              <>
                <div className={styles.modalDoneIcon}>✓</div>
                <div className={styles.modalDoneTitle}>Reserva cancelada</div>
                {cancelModal.booking.client.whatsapp && (
                  <a
                    href={`https://wa.me/${cancelModal.booking.client.whatsapp}?text=${encodeURIComponent(
                      `Hola ${cancelModal.booking.client.name}, lamentablemente tuvimos que cancelar tu reserva del ${formatDateLong(selectedDate)} a las ${cancelModal.booking.startTime} hs en ${business?.name ?? ""}. Disculpá los inconvenientes.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.btnWaNotify}
                  >
                    💬 Avisar al cliente por WhatsApp
                  </a>
                )}
                <button
                  className={styles.btnModalBack}
                  onClick={() => setCancelModal({ open: false, booking: null, reason: "", done: false })}
                >
                  Cerrar
                </button>
              </>
            ) : (
              <>
                <h3 className={styles.modalTitle}>¿Cancelar esta reserva?</h3>
                <div className={styles.modalInfo}>
                  <div className={styles.modalInfoName}>{cancelModal.booking.client.name}</div>
                  <div className={styles.modalInfoTime}>
                    {cancelModal.booking.startTime} – {cancelModal.booking.endTime} hs · {cancelModal.booking.service.name}
                  </div>
                </div>
                <textarea
                  className={styles.modalTextarea}
                  placeholder="Motivo de cancelación (opcional)"
                  value={cancelModal.reason}
                  onChange={e => setCancelModal(m => ({ ...m, reason: e.target.value }))}
                  rows={3}
                />
                <div className={styles.modalActions}>
                  <button
                    className={styles.btnModalConfirmCancel}
                    disabled={actionLoading === cancelModal.booking.id}
                    onClick={async () => {
                      await patchStatus(cancelModal.booking!.id, "CANCELLED");
                      setCancelModal(m => ({ ...m, done: true }));
                    }}
                  >
                    {actionLoading === cancelModal.booking.id ? "Cancelando..." : "Sí, cancelar"}
                  </button>
                  <button
                    className={styles.btnModalBack}
                    onClick={() => setCancelModal(m => ({ ...m, open: false }))}
                  >
                    Volver
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </>
  );
}
