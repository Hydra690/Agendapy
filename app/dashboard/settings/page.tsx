"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./settings.module.css";

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
}

interface DaySchedule {
  dayOfWeek: string;
  label: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
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
  { dayOfWeek: "MONDAY",    label: "Lunes",     isActive: false, startTime: "08:00", endTime: "18:00" },
  { dayOfWeek: "TUESDAY",   label: "Martes",    isActive: false, startTime: "08:00", endTime: "18:00" },
  { dayOfWeek: "WEDNESDAY", label: "Miércoles", isActive: false, startTime: "08:00", endTime: "18:00" },
  { dayOfWeek: "THURSDAY",  label: "Jueves",    isActive: false, startTime: "08:00", endTime: "18:00" },
  { dayOfWeek: "FRIDAY",    label: "Viernes",   isActive: false, startTime: "08:00", endTime: "18:00" },
  { dayOfWeek: "SATURDAY",  label: "Sábado",    isActive: false, startTime: "08:00", endTime: "13:00" },
  { dayOfWeek: "SUNDAY",    label: "Domingo",   isActive: false, startTime: "08:00", endTime: "13:00" },
];

// ---- Helpers ----

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatBlockedDate(isoStr: string): string {
  const datePart = isoStr.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("es-PY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---- Page ----

export default function SettingsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  // Business form
  const [business, setBusiness] = useState<Business | null>(null);
  const [bizForm, setBizForm] = useState({ name: "", description: "", address: "", phone: "", whatsapp: "", logoUrl: "", coverUrl: "", instagram: "", facebook: "" });
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
        availability: ({ dayOfWeek: string; startTime: string; endTime: string; isActive: boolean } | null)[];
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
      });

      setSchedule(DEFAULT_SCHEDULE.map((def, i) => {
        const row = availData.availability[i];
        if (!row) return def;
        return { ...def, isActive: row.isActive, startTime: row.startTime, endTime: row.endTime };
      }));

      setBlockedDates(blockedData.blockedDates ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
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
      if (day.isActive && day.startTime >= day.endTime) {
        setSchedError(`${day.label}: la hora de inicio debe ser anterior al cierre.`);
        return;
      }
    }

    setSchedSaving(true);
    try {
      const res = await fetch("/api/dashboard/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
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

  function updateDay(index: number, patch: Partial<DaySchedule>) {
    setSchedule(prev => prev.map((d, i) => i === index ? { ...d, ...patch } : d));
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

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Logo (URL de imagen)</label>
          <input
            className={styles.formInput}
            type="url"
            value={bizForm.logoUrl}
            onChange={e => setBizForm(f => ({ ...f, logoUrl: e.target.value }))}
            placeholder="https://ejemplo.com/logo.png"
          />
          {bizForm.logoUrl && (
            <div className={styles.logoPreview}>
              <img
                src={bizForm.logoUrl}
                alt="Logo preview"
                className={styles.logoPreviewImg}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Foto de portada (URL de imagen)</label>
          <input
            className={styles.formInput}
            type="url"
            value={bizForm.coverUrl}
            onChange={e => setBizForm(f => ({ ...f, coverUrl: e.target.value }))}
            placeholder="https://ejemplo.com/portada.jpg"
          />
          <span style={{ fontSize: "0.78rem", color: "#8888aa", marginTop: 4, display: "block" }}>
            Se muestra como imagen de cabecera en tu página pública. Recomendado: 1200×400 px.
          </span>
          {bizForm.coverUrl && (
            <div className={styles.logoPreview} style={{ borderRadius: 8, overflow: "hidden", marginTop: 8 }}>
              <img
                src={bizForm.coverUrl}
                alt="Cover preview"
                style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </div>

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
                  onChange={e => updateDay(i, { isActive: e.target.checked })}
                  className={styles.scheduleCheckbox}
                />
                <span className={`${styles.scheduleToggleTrack} ${day.isActive ? styles.scheduleToggleOn : ""}`} />
              </label>

              <span className={styles.scheduleDayLabel}>{day.label}</span>

              {day.isActive ? (
                <div className={styles.scheduleTimePicker}>
                  <input
                    type="time"
                    value={day.startTime}
                    onChange={e => updateDay(i, { startTime: e.target.value })}
                    className={styles.timeInput}
                  />
                  <span className={styles.timeSep}>–</span>
                  <input
                    type="time"
                    value={day.endTime}
                    onChange={e => updateDay(i, { endTime: e.target.value })}
                    className={styles.timeInput}
                  />
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
