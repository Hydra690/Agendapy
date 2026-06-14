"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./services.module.css";

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number | null;
  description: string | null;
  isActive: boolean;
}

interface FormState {
  name: string;
  duration: string;
  price: string;
  description: string;
}

const EMPTY_FORM: FormState = { name: "", duration: "", price: "", description: "" };

function formatPrice(price: number | null): string {
  if (price === null) return "A consultar";
  return `Gs. ${new Intl.NumberFormat("es-PY").format(price)}`;
}

export default function ServicesPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
  }, [authStatus, router]);

  const loadServices = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/services");
      const data = await res.json() as { services: Service[] };
      setServices(data.services ?? []);
    } catch { setServices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") loadServices();
  }, [authStatus, loadServices]);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(s: Service) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      duration: String(s.duration),
      price: s.price !== null ? String(s.price) : "",
      description: s.description ?? "",
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.name.trim()) { setFormError("El nombre es requerido."); return; }
    if (!form.duration || Number(form.duration) < 5) { setFormError("La duración mínima es 5 minutos."); return; }

    setSaving(true);
    try {
      const url = editingId ? `/api/dashboard/services/${editingId}` : "/api/dashboard/services";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          duration: Number(form.duration),
          price: form.price !== "" ? Number(form.price) : null,
          description: form.description.trim() || null,
        }),
      });

      const data = await res.json() as { error?: string };
      if (!res.ok) { setFormError(data.error ?? "Error al guardar."); return; }

      await loadServices();
      closeForm();
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Service) {
    setTogglingId(s.id);
    try {
      await fetch(`/api/dashboard/services/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      await loadServices();
    } catch { /* ignore */ }
    finally { setTogglingId(null); }
  }

  if (loading) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.skeletonLine} style={{ height: 28, width: 160, marginBottom: 8 }} />
            <div className={styles.skeletonLine} style={{ height: 16, width: 240 }} />
          </div>
        </div>
        <div className={styles.serviceList}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1.5px solid #e8eaf0", display: "flex", gap: 16, alignItems: "center" }}>
              <div className={styles.skeletonLine} style={{ width: 40, height: 40, borderRadius: 8 }} />
              <div style={{ flex: 1 }}>
                <div className={styles.skeletonLine} style={{ height: 16, width: "40%", marginBottom: 8 }} />
                <div className={styles.skeletonLine} style={{ height: 13, width: "60%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Servicios</h1>
          <p className={styles.pageSub}>
            {services.length === 0
              ? "Agregá tu primer servicio para empezar a recibir turnos"
              : `${services.filter(s => s.isActive).length} activo${services.filter(s => s.isActive).length !== 1 ? "s" : ""} · ${services.length} en total`}
          </p>
        </div>
        {!showForm && (
          <button className={styles.btnNew} onClick={openNew}>
            + Nuevo servicio
          </button>
        )}
      </div>

      {/* ---- FORM ---- */}
      {showForm && (
        <div className={styles.formCard}>
          <div className={styles.formTitle}>
            {editingId ? "Editar servicio" : "Nuevo servicio"}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nombre del servicio *</label>
              <input
                className={styles.formInput}
                type="text"
                placeholder="Ej: Corte de cabello"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Duración (min) *</label>
              <input
                className={styles.formInput}
                type="number"
                min="5"
                step="5"
                placeholder="30"
                value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Precio (Gs.) — opcional</label>
              <input
                className={styles.formInput}
                type="number"
                min="0"
                placeholder="Dejar vacío = A consultar"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              />
            </div>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Descripción — opcional</label>
            <input
              className={styles.formInput}
              type="text"
              placeholder="Ej: Incluye lavado y secado"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          {formError && <div className={styles.formError}>{formError}</div>}

          <div className={styles.formActions}>
            <button
              className={styles.btnSave}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear servicio"}
            </button>
            <button className={styles.btnCancelForm} onClick={closeForm} disabled={saving}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ---- LIST ---- */}
      {services.length === 0 && !showForm && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🛠️</div>
          <div className={styles.emptyTitle}>Sin servicios todavía</div>
          <p className={styles.emptyMsg}>Creá tu primer servicio y aparecerá en tu página pública.</p>
        </div>
      )}

      {services.length > 0 && (
        <div className={styles.serviceList}>
          {services.map(s => (
            <div
              key={s.id}
              className={`${styles.serviceCard} ${!s.isActive ? styles.serviceCardInactive : ""}`}
            >
              <div className={styles.serviceIcon}>🛠️</div>
              <div className={styles.serviceInfo}>
                <div className={styles.serviceName}>{s.name}</div>
                <div className={styles.serviceMeta}>
                  {s.duration} min · {formatPrice(s.price)}
                  {s.description && ` · ${s.description}`}
                </div>
              </div>
              <div className={styles.serviceCardRight}>
                <span className={s.isActive ? styles.badgeActive : styles.badgeInactive}>
                  {s.isActive ? "Activo" : "Inactivo"}
                </span>
                <button
                  className={styles.btnEdit}
                  onClick={() => openEdit(s)}
                  disabled={togglingId === s.id}
                >
                  Editar
                </button>
                <button
                  className={styles.btnToggle}
                  onClick={() => toggleActive(s)}
                  disabled={togglingId === s.id}
                  title={s.isActive ? "Desactivar servicio" : "Reactivar servicio"}
                >
                  {togglingId === s.id ? "..." : s.isActive ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
