"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ServiceLite { id: string; name: string; }
interface Staff {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  isActive: boolean;
  services: ServiceLite[];
}

interface FormState {
  name: string;
  role: string;
  phone: string;
  serviceIds: string[];
}

const EMPTY_FORM: FormState = { name: "", role: "", phone: "", serviceIds: [] };

const S = {
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e8eaf0",
    fontSize: "0.9rem", boxSizing: "border-box" as const, outline: "none", fontFamily: "inherit",
  },
  label: { display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#1A1A2E", marginBottom: 6 },
  btnPrimary: {
    background: "#00c48c", color: "#fff", border: "none", borderRadius: 8,
    padding: "9px 18px", fontWeight: 700, fontSize: "0.86rem", cursor: "pointer",
  },
  btnGhost: {
    background: "#fff", color: "#4A4A6A", border: "1.5px solid #e8eaf0", borderRadius: 8,
    padding: "9px 18px", fontWeight: 600, fontSize: "0.86rem", cursor: "pointer",
  },
};

export default function StaffPage() {
  const { status } = useSession();
  const router = useRouter();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadAll = useCallback(async () => {
    try {
      const [staffRes, svcRes] = await Promise.all([
        fetch("/api/dashboard/staff"),
        fetch("/api/dashboard/services"),
      ]);
      const staffData = await staffRes.json() as { staff: Staff[] };
      const svcData = await svcRes.json() as { services: ServiceLite[] };
      setStaff(staffData.staff ?? []);
      setServices(svcData.services ?? []);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    if (status === "authenticated") loadAll();
  }, [status, loadAll]);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(s: Staff) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      role: s.role ?? "",
      phone: s.phone ?? "",
      serviceIds: s.services.map(x => x.id),
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

  function toggleService(id: string) {
    setForm(f => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter(x => x !== id)
        : [...f.serviceIds, id],
    }));
  }

  async function handleSave() {
    setFormError(null);
    if (form.name.trim().length < 2) { setFormError("El nombre debe tener al menos 2 caracteres."); return; }

    setSaving(true);
    try {
      const url = editingId ? `/api/dashboard/staff/${editingId}` : "/api/dashboard/staff";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role.trim() || null,
          phone: form.phone.trim() || null,
          serviceIds: form.serviceIds,
        }),
      });
      const data = await res.json() as { error?: string; message?: string };
      if (!res.ok) { setFormError(data.message ?? data.error ?? "Error al guardar."); return; }
      await loadAll();
      closeForm();
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Staff) {
    setTogglingId(s.id);
    try {
      if (s.isActive) {
        await fetch(`/api/dashboard/staff/${s.id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/dashboard/staff/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
      }
      await loadAll();
    } catch { /* ignore */ }
    finally { setTogglingId(null); }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1A1A2E", marginBottom: 4 }}>Profesionales</h1>
          <p style={{ color: "#4A4A6A", fontSize: "0.88rem" }}>
            Cargá a las personas que atienden. Cada una tendrá su propia agenda y servicios.
          </p>
        </div>
        {!showForm && (
          <button style={S.btnPrimary} onClick={openNew}>+ Nuevo profesional</button>
        )}
      </div>

      {showForm && (
        <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ fontWeight: 800, color: "#1A1A2E", marginBottom: 16 }}>
            {editingId ? "Editar profesional" : "Nuevo profesional"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input style={S.input} type="text" placeholder="Ej: Ana" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label style={S.label}>Rol — opcional</label>
              <input style={S.input} type="text" placeholder="Ej: Barbera" value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Teléfono — opcional</label>
              <input style={S.input} type="text" placeholder="Ej: 0981..." value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Servicios que realiza</label>
            {services.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "#8888aa" }}>
                Todavía no cargaste servicios. Si dejás esto vacío, el profesional podrá hacer todos.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {services.map(svc => {
                  const on = form.serviceIds.includes(svc.id);
                  return (
                    <button key={svc.id} type="button" onClick={() => toggleService(svc.id)}
                      style={{
                        border: `1.5px solid ${on ? "#00c48c" : "#e8eaf0"}`,
                        background: on ? "#e8fff6" : "#fff",
                        color: on ? "#0f7a55" : "#4A4A6A",
                        borderRadius: 99, padding: "6px 14px", fontSize: "0.82rem",
                        fontWeight: 600, cursor: "pointer",
                      }}>
                      {on ? "✓ " : ""}{svc.name}
                    </button>
                  );
                })}
              </div>
            )}
            <p style={{ fontSize: "0.76rem", color: "#8888aa", marginTop: 6 }}>
              Vacío = puede hacer todos los servicios.
            </p>
          </div>

          {formError && (
            <div style={{ background: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC0000", borderRadius: 8, padding: "9px 14px", fontSize: "0.84rem", marginBottom: 12 }}>
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear profesional"}
            </button>
            <button style={S.btnGhost} onClick={closeForm} disabled={saving}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: "#4A4A6A", fontSize: "0.9rem" }}>Cargando...</div>
      ) : staff.length === 0 && !showForm ? (
        <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 16, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>✂️</div>
          <div style={{ fontWeight: 700, color: "#1A1A2E", marginBottom: 6 }}>Sin profesionales todavía</div>
          <p style={{ color: "#4A4A6A", fontSize: "0.88rem" }}>
            Si atendés solo vos, no hace falta cargar nada: el negocio funciona como un único recurso.
            Agregá profesionales cuando seas más de una persona.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {staff.map(s => (
            <div key={s.id} style={{
              background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 14,
              padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, opacity: s.isActive ? 1 : 0.6, flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#1A1A2E", fontSize: "0.95rem" }}>
                  {s.name}{s.role ? <span style={{ color: "#8888aa", fontWeight: 500 }}> · {s.role}</span> : null}
                </div>
                {s.phone && <div style={{ fontSize: "0.8rem", color: "#4A4A6A", marginTop: 2 }}>📱 {s.phone}</div>}
                <div style={{ fontSize: "0.78rem", color: "#8888aa", marginTop: 3 }}>
                  {s.services.length === 0 ? "Todos los servicios" : s.services.map(x => x.name).join(", ")}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: "0.72rem", fontWeight: 700, borderRadius: 99, padding: "2px 10px",
                  background: s.isActive ? "#e8fff6" : "#f0f2f8", color: s.isActive ? "#00c48c" : "#8888aa",
                }}>
                  {s.isActive ? "Activo" : "Inactivo"}
                </span>
                <button style={S.btnGhost} onClick={() => router.push(`/dashboard/staff/${s.id}`)} disabled={togglingId === s.id}>Horario</button>
                <button style={S.btnGhost} onClick={() => openEdit(s)} disabled={togglingId === s.id}>Editar</button>
                <button style={S.btnGhost} onClick={() => toggleActive(s)} disabled={togglingId === s.id}>
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
