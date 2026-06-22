"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./settings.module.css";
import { usePlan } from "../usePlan";
import { todayISO, formatDayMonthYear } from "@/lib/format";
import ImageUploadField from "./ImageUploadField";

const TIER_LABEL: Record<string, string> = { FREE: "Gratuito", BASIC: "Básico", PRO: "PRO" };

// Formateo de fecha en helper (no en render directo) para no disparar la regla de
// funciones impuras en el render de los archivos grandes del dashboard.
function fmtPlanDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PY", { day: "numeric", month: "long", year: "numeric" });
}

// ---- Types ----

interface Business {
  id: string;
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
  cancellationWindowHours: number;
  minBookingNoticeMinutes: number;
}

interface Interval {
  startTime: string;
  endTime: string;
}

interface DaySchedule {
  dayOfWeek: string;
  label: string;
  isActive: boolean;
  intervals: Interval[];   // turno partido: 1+ intervalos por día
}

interface BlockedDate {
  id: string;
  date: string;
  reason: string | null;
}

// ---- Constants ----

const CATEGORY_LABEL: Record<string, string> = {
  BARBERSHOP: "Barbería",
  BEAUTY_SALON: "Salón de belleza",
  VETERINARY: "Veterinaria",
  PSYCHOLOGY: "Psicología",
  DENTISTRY: "Odontología",
  MEDICINE: "Medicina general",
  FITNESS: "Entrenador / Gimnasio",
  PHOTOGRAPHY: "Fotografía",
  TUTORING: "Clases particulares",
  MASSAGE: "Masajes / Spa",
  OTHER: "Otros",
};

const DEFAULT_SCHEDULE: DaySchedule[] = [
  { dayOfWeek: "MONDAY",    label: "Lunes",     isActive: false, intervals: [{ startTime: "08:00", endTime: "18:00" }] },
  { dayOfWeek: "TUESDAY",   label: "Martes",    isActive: false, intervals: [{ startTime: "08:00", endTime: "18:00" }] },
  { dayOfWeek: "WEDNESDAY", label: "Miércoles", isActive: false, intervals: [{ startTime: "08:00", endTime: "18:00" }] },
  { dayOfWeek: "THURSDAY",  label: "Jueves",    isActive: false, intervals: [{ startTime: "08:00", endTime: "18:00" }] },
  { dayOfWeek: "FRIDAY",    label: "Viernes",   isActive: false, intervals: [{ startTime: "08:00", endTime: "18:00" }] },
  { dayOfWeek: "SATURDAY",  label: "Sábado",    isActive: false, intervals: [{ startTime: "08:00", endTime: "13:00" }] },
  { dayOfWeek: "SUNDAY",    label: "Domingo",   isActive: false, intervals: [{ startTime: "08:00", endTime: "13:00" }] },
];

const DEFAULT_INTERVAL: Interval = { startTime: "08:00", endTime: "18:00" };

// ---- Helpers ----

// La fecha bloqueada viene como ISO con hora; sacamos el día y reusamos el formatter.
function formatBlockedDate(isoStr: string): string {
  return formatDayMonthYear(isoStr.split("T")[0]);
}

// ---- Page ----

export default function SettingsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const { plan } = usePlan();

  const [loading, setLoading] = useState(true);

  // Business form
  const [business, setBusiness] = useState<Business | null>(null);
  const [bizForm, setBizForm] = useState({ name: "", description: "", address: "", phone: "", whatsapp: "", logoUrl: "", coverUrl: "", instagram: "", facebook: "", cancellationWindowHours: 2, minBookingNoticeMinutes: 0 });
  const [bizError, setBizError] = useState<string | null>(null);
  const [bizSaving, setBizSaving] = useState(false);
  const [bizSaved, setBizSaved] = useState(false);

  // Schedule form
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [schedError, setSchedError] = useState<string | null>(null);
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedSaved, setSchedSaved] = useState(false);

  // Blocked dates
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
  }, [authStatus, router]);

  const loadData = useCallback(async () => {
    try {
      const [bizRes, availRes, blockedRes] = await Promise.all([
        fetch("/api/dashboard/business"),
        fetch("/api/dashboard/availability"),
        fetch("/api/dashboard/blocked-dates"),
      ]);

      if (bizRes.status === 404) { router.push("/onboarding"); return; }

      const bizData = await bizRes.json() as { business: Business };
      const availData = await availRes.json() as {
        availability: { dayOfWeek: string; isActive: boolean; intervals: Interval[] }[];
      };
      const blockedData = await blockedRes.json() as { blockedDates: BlockedDate[] };

      setBusiness(bizData.business);
      setBizForm({
        name: bizData.business.name,
        description: bizData.business.description ?? "",
        address: bizData.business.address ?? "",
        phone: bizData.business.phone ?? "",
        whatsapp: bizData.business.whatsapp ?? "",
        logoUrl: bizData.business.logoUrl ?? "",
        coverUrl: bizData.business.coverUrl ?? "",
        instagram: bizData.business.instagram ?? "",
        facebook: bizData.business.facebook ?? "",
        cancellationWindowHours: bizData.business.cancellationWindowHours ?? 2,
        minBookingNoticeMinutes: bizData.business.minBookingNoticeMinutes ?? 0,
      });

      setSchedule(DEFAULT_SCHEDULE.map((def) => {
        const row = availData.availability.find(r => r.dayOfWeek === def.dayOfWeek);
        if (!row) return def;
        return {
          ...def,
          isActive: row.isActive,
          // Un día activo siempre tiene al menos un intervalo; si no, usamos el default.
          intervals: row.intervals.length > 0 ? row.intervals : def.intervals,
        };
      }));

      setBlockedDates(blockedData.blockedDates ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    if (authStatus === "authenticated") loadData();
  }, [authStatus, loadData]);

  async function saveBusiness() {
    setBizError(null);
    setBizSaved(false);
    if (!bizForm.name.trim()) { setBizError("El nombre es requerido."); return; }
    setBizSaving(true);
    try {
      const res = await fetch("/api/dashboard/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bizForm),
      });
      const data = await res.json() as { error?: string; fields?: Record<string, string>; business?: Business };
      if (!res.ok) {
        // Mostrar el detalle por campo si el server lo devuelve (ej. URL inválida).
        const fieldMsg = data.fields ? Object.values(data.fields)[0] : null;
        setBizError(fieldMsg ?? data.error ?? "Error al guardar.");
        return;
      }
      setBusiness(data.business!);
      setBizSaved(true);
      setTimeout(() => setBizSaved(false), 3000);
    } catch {
      setBizError("No se pudo conectar con el servidor.");
    } finally {
      setBizSaving(false);
    }
  }

  async function saveSchedule() {
    setSchedError(null);
    setSchedSaved(false);

    for (const day of schedule) {
      if (!day.isActive) continue;
      if (day.intervals.length === 0) {
        setSchedError(`${day.label}: agregá al menos un intervalo o desactivá el día.`);
        return;
      }
      for (const iv of day.intervals) {
        if (iv.startTime >= iv.endTime) {
          setSchedError(`${day.label}: la hora de inicio debe ser anterior al cierre.`);
          return;
        }
      }
      const sorted = [...day.intervals].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let k = 1; k < sorted.length; k++) {
        if (sorted[k].startTime < sorted[k - 1].endTime) {
          setSchedError(`${day.label}: los intervalos no pueden solaparse.`);
          return;
        }
      }
    }

    setSchedSaving(true);
    try {
      const res = await fetch("/api/dashboard/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule: schedule.map(d => ({ dayOfWeek: d.dayOfWeek, isActive: d.isActive, intervals: d.intervals })),
        }),
      });
      if (!res.ok) { setSchedError("Error al guardar los horarios."); return; }
      setSchedSaved(true);
      setTimeout(() => setSchedSaved(false), 3000);
    } catch {
      setSchedError("No se pudo conectar con el servidor.");
    } finally {
      setSchedSaving(false);
    }
  }

  async function addBlockedDate() {
    setBlockError(null);
    if (!newBlockDate) { setBlockError("Seleccioná una fecha."); return; }
    setBlockSaving(true);
    try {
      const res = await fetch("/api/dashboard/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newBlockDate,
          reason: newBlockReason.trim() || undefined,
        }),
      });
      const data = await res.json() as { error?: string; blockedDate?: BlockedDate };
      if (!res.ok) { setBlockError(data.error ?? "Error al bloquear la fecha."); return; }
      setBlockedDates(prev =>
        [...prev, data.blockedDate!].sort((a, b) => a.date.localeCompare(b.date))
      );
      setNewBlockDate("");
      setNewBlockReason("");
    } catch {
      setBlockError("No se pudo conectar con el servidor.");
    } finally {
      setBlockSaving(false);
    }
  }

  async function removeBlockedDate(id: string) {
    try {
      await fetch("/api/dashboard/blocked-dates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setBlockedDates(prev => prev.filter(b => b.id !== id));
    } catch {
      // ignore
    }
  }

  function toggleDay(index: number, active: boolean) {
    setSchedule(prev => prev.map((d, i) => {
      if (i !== index) return d;
      // Al activar un día sin intervalos, le damos uno por defecto.
      if (active && d.intervals.length === 0) return { ...d, isActive: true, intervals: [{ ...DEFAULT_INTERVAL }] };
      return { ...d, isActive: active };
    }));
  }

  function updateInterval(dayIndex: number, ivIndex: number, patch: Partial<Interval>) {
    setSchedule(prev => prev.map((d, i) =>
      i === dayIndex
        ? { ...d, intervals: d.intervals.map((iv, j) => (j === ivIndex ? { ...iv, ...patch } : iv)) }
        : d
    ));
  }

  function addInterval(dayIndex: number) {
    setSchedule(prev => prev.map((d, i) =>
      i === dayIndex ? { ...d, intervals: [...d.intervals, { startTime: "14:00", endTime: "18:00" }] } : d
    ));
  }

  function removeInterval(dayIndex: number, ivIndex: number) {
    setSchedule(prev => prev.map((d, i) =>
      i === dayIndex ? { ...d, intervals: d.intervals.filter((_, j) => j !== ivIndex) } : d
    ));
  }

  if (loading) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <div className={styles.skeletonLine} style={{ height: 28, width: 180, marginBottom: 8 }} />
          <div className={styles.skeletonLine} style={{ height: 16, width: 260 }} />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className={styles.section}>
            <div className={styles.skeletonLine} style={{ height: 20, width: 140, marginBottom: 20 }} />
            {[1, 2, 3].map(j => (
              <div key={j} className={styles.skeletonLine} style={{ height: 42, marginBottom: 12 }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Configuración</h1>
          <p className={styles.pageSub}>
            {business ? `${business.name} · /${business.slug} · ${CATEGORY_LABEL[business.category] ?? business.category}` : ""}
          </p>
        </div>
      </div>

      {/* ---- PLAN ACTUAL ---- */}
      {plan && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Tu plan</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1A1A2E" }}>
              Plan {TIER_LABEL[plan.tier] ?? plan.tier}
            </span>
            {plan.onTrial && plan.trialEndsAt && (
              <span style={{ background: "#e8f9f1", color: "#0f7a55", borderRadius: 99, padding: "3px 12px", fontSize: "0.78rem", fontWeight: 700 }}>
                En prueba · vence el {fmtPlanDate(plan.trialEndsAt)}
              </span>
            )}
            {!plan.onTrial && plan.tier !== "FREE" && plan.planExpiry && (
              <span style={{ background: "#e8f9f1", color: "#0f7a55", borderRadius: 99, padding: "3px 12px", fontSize: "0.78rem", fontWeight: 700 }}>
                Activo hasta el {fmtPlanDate(plan.planExpiry)}
              </span>
            )}
            {!plan.onTrial && plan.tier === "FREE" && (
              <span style={{ background: "#fff8e1", color: "#92400e", borderRadius: 99, padding: "3px 12px", fontSize: "0.78rem", fontWeight: 700 }}>
                Funciones premium desactivadas
              </span>
            )}
          </div>
          {plan.tier === "FREE" && (
            <p className={styles.sectionSub} style={{ marginTop: 10, marginBottom: 0 }}>
              Activá un plan para recordatorios automáticos por WhatsApp, export de CSV, métricas y más.{" "}
              <a href="mailto:hola@agendapy.com.py?subject=Quiero contratar el plan" style={{ color: "#f59e0b", fontWeight: 700, textDecoration: "none" }}>
                Contratar plan
              </a>
            </p>
          )}
        </div>
      )}

      {/* ---- DATOS DEL NEGOCIO ---- */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Datos del negocio</div>

        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nombre *</label>
            <input
              className={styles.formInput}
              type="text"
              value={bizForm.name}
              onChange={e => setBizForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nombre de tu negocio"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Teléfono</label>
            <input
              className={styles.formInput}
              type="text"
              value={bizForm.phone}
              onChange={e => setBizForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="Ej: 0981 123 456"
            />
          </div>
        </div>

        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>WhatsApp</label>
            <input
              className={styles.formInput}
              type="text"
              value={bizForm.whatsapp}
              onChange={e => setBizForm(f => ({ ...f, whatsapp: e.target.value }))}
              placeholder="Ej: 595981123456"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Dirección</label>
            <input
              className={styles.formInput}
              type="text"
              value={bizForm.address}
              onChange={e => setBizForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Ej: Av. España 1234, Asunción"
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Descripción</label>
          <textarea
            className={`${styles.formInput} ${styles.formTextarea}`}
            value={bizForm.description}
            onChange={e => setBizForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Contá brevemente qué hacés o qué ofrece tu negocio"
            rows={3}
          />
        </div>

        <ImageUploadField
          label="Logo"
          variant="logo"
          value={bizForm.logoUrl}
          onChange={url => setBizForm(f => ({ ...f, logoUrl: url }))}
        />

        <ImageUploadField
          label="Foto de portada"
          variant="cover"
          hint="Se muestra como imagen de cabecera en tu página pública. Recomendado: 1200×400 px."
          value={bizForm.coverUrl}
          onChange={url => setBizForm(f => ({ ...f, coverUrl: url }))}
        />

        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Instagram</label>
            <input
              className={styles.formInput}
              type="text"
              value={bizForm.instagram}
              onChange={e => setBizForm(f => ({ ...f, instagram: e.target.value.replace(/^@/, "") }))}
              placeholder="mi_negocio (sin @)"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Facebook</label>
            <input
              className={styles.formInput}
              type="text"
              value={bizForm.facebook}
              onChange={e => setBizForm(f => ({ ...f, facebook: e.target.value }))}
              placeholder="mi.negocio o URL completa"
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Cancelación del cliente</label>
          <select
            className={styles.formInput}
            value={bizForm.cancellationWindowHours}
            onChange={e => setBizForm(f => ({ ...f, cancellationWindowHours: Number(e.target.value) }))}
          >
            <option value={0}>Hasta el momento del turno</option>
            <option value={1}>Hasta 1 hora antes</option>
            <option value={2}>Hasta 2 horas antes</option>
            <option value={3}>Hasta 3 horas antes</option>
            <option value={6}>Hasta 6 horas antes</option>
            <option value={12}>Hasta 12 horas antes</option>
            <option value={24}>Hasta 24 horas antes</option>
            <option value={48}>Hasta 48 horas antes</option>
          </select>
          <span style={{ fontSize: "0.78rem", color: "#8888aa", marginTop: 4, display: "block" }}>
            Hasta cuándo tus clientes pueden cancelar solos desde su link de reserva. Después de ese plazo, deberán contactarte.
          </span>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Antelación mínima para reservar</label>
          <select
            className={styles.formInput}
            value={bizForm.minBookingNoticeMinutes}
            onChange={e => setBizForm(f => ({ ...f, minBookingNoticeMinutes: Number(e.target.value) }))}
          >
            <option value={0}>Sin mínimo (no se ofrecen horas ya pasadas)</option>
            <option value={15}>15 minutos antes</option>
            <option value={30}>30 minutos antes</option>
            <option value={60}>1 hora antes</option>
            <option value={120}>2 horas antes</option>
            <option value={180}>3 horas antes</option>
            <option value={360}>6 horas antes</option>
            <option value={720}>12 horas antes</option>
            <option value={1440}>24 horas antes</option>
          </select>
          <span style={{ fontSize: "0.78rem", color: "#8888aa", marginTop: 4, display: "block" }}>
            Con cuánta anticipación deben reservar tus clientes. Evita reservas de último momento. En todos los casos, los horarios ya pasados del día no se ofrecen.
          </span>
        </div>

        {bizError && <div className={styles.formError}>{bizError}</div>}

        <div className={styles.formActions}>
          <button className={styles.btnSave} onClick={saveBusiness} disabled={bizSaving}>
            {bizSaving ? "Guardando..." : "Guardar cambios"}
          </button>
          {bizSaved && <span className={styles.savedMsg}>✓ Guardado</span>}
        </div>
      </div>

      {/* ---- HORARIOS ---- */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Horarios de atención</div>
        <p className={styles.sectionSub}>Configurá los días y horarios en que tu negocio atiende reservas.</p>

        <div className={styles.scheduleList}>
          {schedule.map((day, i) => (
            <div key={day.dayOfWeek} className={`${styles.scheduleRow} ${!day.isActive ? styles.scheduleRowInactive : ""}`}>
              <label className={styles.scheduleToggle}>
                <input
                  type="checkbox"
                  checked={day.isActive}
                  onChange={e => toggleDay(i, e.target.checked)}
                  className={styles.scheduleCheckbox}
                />
                <span className={`${styles.scheduleToggleTrack} ${day.isActive ? styles.scheduleToggleOn : ""}`} />
              </label>

              <span className={styles.scheduleDayLabel}>{day.label}</span>

              {day.isActive ? (
                <div className={styles.scheduleTimePicker} style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                  {day.intervals.map((iv, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="time"
                        value={iv.startTime}
                        onChange={e => updateInterval(i, j, { startTime: e.target.value })}
                        className={styles.timeInput}
                      />
                      <span className={styles.timeSep}>–</span>
                      <input
                        type="time"
                        value={iv.endTime}
                        onChange={e => updateInterval(i, j, { endTime: e.target.value })}
                        className={styles.timeInput}
                      />
                      {day.intervals.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInterval(i, j)}
                          title="Quitar intervalo"
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1rem", padding: "0 4px" }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addInterval(i)}
                    style={{ background: "none", border: "none", color: "#00c48c", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", padding: 0 }}
                  >
                    + Agregar intervalo (turno partido)
                  </button>
                </div>
              ) : (
                <span className={styles.scheduleClosed}>Cerrado</span>
              )}
            </div>
          ))}
        </div>

        {schedError && <div className={styles.formError}>{schedError}</div>}

        <div className={styles.formActions}>
          <button className={styles.btnSave} onClick={saveSchedule} disabled={schedSaving}>
            {schedSaving ? "Guardando..." : "Guardar horarios"}
          </button>
          {schedSaved && <span className={styles.savedMsg}>✓ Guardado</span>}
        </div>
      </div>

      {/* ---- DÍAS BLOQUEADOS ---- */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Días bloqueados</div>
        <p className={styles.sectionSub}>
          Bloqueá fechas en las que no atendés: feriados, vacaciones o días personales.
          Tus clientes no podrán reservar esos días.
        </p>

        <div className={styles.blockedAddRow}>
          <input
            type="date"
            className={`${styles.formInput} ${styles.blockedDateInput}`}
            value={newBlockDate}
            min={todayISO()}
            onChange={e => setNewBlockDate(e.target.value)}
          />
          <input
            type="text"
            className={`${styles.formInput} ${styles.blockedReasonInput}`}
            value={newBlockReason}
            onChange={e => setNewBlockReason(e.target.value)}
            placeholder="Motivo: Feriado Nacional, Vacaciones..."
          />
          <button
            className={styles.btnAdd}
            onClick={addBlockedDate}
            disabled={blockSaving || !newBlockDate}
          >
            {blockSaving ? "Bloqueando..." : "+ Bloquear día"}
          </button>
        </div>

        <p className={styles.sectionSub} style={{ marginTop: 8, marginBottom: 0 }}>
          💡 El motivo lo verán tus clientes al intentar reservar ese día. Escribilo con claridad.
        </p>

        {blockError && <div className={styles.formError}>{blockError}</div>}

        <div className={styles.blockedList}>
          {blockedDates.length === 0 ? (
            <div className={styles.emptyBlocked}>
              Sin días bloqueados. Podés bloquear feriados o días de vacaciones arriba.
            </div>
          ) : (
            blockedDates.map(b => (
              <div key={b.id} className={styles.blockedItem}>
                <div className={styles.blockedItemLeft}>
                  <span className={styles.blockedDateLabel}>
                    📅 {formatBlockedDate(b.date)}
                  </span>
                  {b.reason && (
                    <span className={styles.blockedReasonLabel}>{b.reason}</span>
                  )}
                </div>
                <button
                  className={styles.btnRemove}
                  onClick={() => removeBlockedDate(b.id)}
                >
                  Desbloquear
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
