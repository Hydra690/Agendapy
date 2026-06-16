"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import PlanUpsell from "../../components/PlanUpsell";

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  service: { name: string; price: number | null; duration: number };
}

interface Client {
  id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  bookings: Booking[];
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente", CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado", COMPLETED: "Completado", NO_SHOW: "No asistió",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b", CONFIRMED: "#00c48c",
  CANCELLED: "#ef4444", COMPLETED: "#6366f1", NO_SHOW: "#8888aa",
};

function formatDate(isoStr: string): string {
  const part = isoStr.split("T")[0];
  const [y, m, d] = part.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PY", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatPrice(price: number | null): string {
  if (price === null) return "A consultar";
  return `Gs. ${new Intl.NumberFormat("es-PY").format(price)}`;
}

export default function ClientDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/dashboard/clients/${id}`)
      .then(r => {
        if (r.status === 404) { router.push("/dashboard/clients"); return null; }
        if (r.status === 403) { setLocked(true); return null; }
        return r.json() as Promise<{ client: Client }>;
      })
      .then(data => {
        if (data) {
          setClient(data.client);
          setNotes(data.client.notes ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, id, router]);

  async function saveNotes() {
    if (!client) return;
    setNotesSaving(true);
    setNotesSaved(false);
    try {
      await fetch(`/api/dashboard/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setNotesSaving(false); }
  }

  if (loading) return <div style={{ color: "#4A4A6A", fontSize: "0.9rem" }}>Cargando...</div>;
  if (locked) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => router.push("/dashboard/clients")}
            style={{ color: "#8888aa", fontSize: "0.85rem", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
          >
            ← Volver a clientes
          </button>
        </div>
        <PlanUpsell
          title="El detalle de clientes es una función del plan"
          message="La ficha completa, el historial de reservas y las notas internas de cada cliente están disponibles en los planes pagos. Activá un plan para acceder."
        />
      </div>
    );
  }
  if (!client) return null;

  const completed = client.bookings.filter(b => b.status === "COMPLETED").length;
  const cancelled = client.bookings.filter(b => b.status === "CANCELLED").length;
  const totalSpent = client.bookings
    .filter(b => b.status === "COMPLETED")
    .reduce((sum, b) => sum + (b.service.price ?? 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard/clients" style={{ color: "#8888aa", fontSize: "0.85rem", textDecoration: "none" }}>
          ← Volver a clientes
        </Link>
      </div>

      {/* Client header */}
      <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 16, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", background: "#e8fff6",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem", flexShrink: 0,
          }}>👤</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1A1A2E", marginBottom: 2 }}>{client.name}</h1>
            {client.whatsapp && (
              <a
                href={`https://wa.me/${client.whatsapp}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: "0.85rem", color: "#25D366", textDecoration: "none", fontWeight: 600 }}
              >
                💬 {client.whatsapp}
              </a>
            )}
            {client.email && (
              <div style={{ fontSize: "0.82rem", color: "#4A4A6A", marginTop: 2 }}>✉ {client.email}</div>
            )}
            <div style={{ fontSize: "0.78rem", color: "#8888aa", marginTop: 4 }}>
              Cliente desde {formatDate(client.createdAt)}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 24, marginTop: 18, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#00c48c" }}>{completed}</div>
            <div style={{ fontSize: "0.75rem", color: "#8888aa" }}>visitas completadas</div>
          </div>
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1A1A2E" }}>{client.bookings.length}</div>
            <div style={{ fontSize: "0.75rem", color: "#8888aa" }}>reservas totales</div>
          </div>
          {cancelled > 0 && (
            <div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ef4444" }}>{cancelled}</div>
              <div style={{ fontSize: "0.75rem", color: "#8888aa" }}>canceladas</div>
            </div>
          )}
          {totalSpent > 0 && (
            <div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#6366f1" }}>
                Gs. {new Intl.NumberFormat("es-PY").format(totalSpent)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#8888aa" }}>gasto total estimado</div>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 16, padding: "18px 24px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: "#1A1A2E", fontSize: "0.9rem", marginBottom: 10 }}>
          📝 Notas internas
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej: Alérgica al amoniaco. Prefiere turno tarde. Trae a su hija."
          rows={3}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e8eaf0",
            fontSize: "0.88rem", resize: "vertical", boxSizing: "border-box", outline: "none",
            fontFamily: "inherit", color: "#1A1A2E",
          }}
          onFocus={e => (e.target.style.borderColor = "#00c48c")}
          onBlur={e => (e.target.style.borderColor = "#e8eaf0")}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <button
            onClick={saveNotes}
            disabled={notesSaving}
            style={{
              background: "#00c48c", color: "#fff", border: "none", borderRadius: 8,
              padding: "7px 18px", fontWeight: 700, fontSize: "0.84rem", cursor: "pointer",
            }}
          >
            {notesSaving ? "Guardando..." : "Guardar nota"}
          </button>
          {notesSaved && <span style={{ color: "#00c48c", fontSize: "0.82rem", fontWeight: 600 }}>✓ Guardado</span>}
        </div>
      </div>

      {/* Booking history */}
      <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 16, padding: "18px 24px" }}>
        <div style={{ fontWeight: 700, color: "#1A1A2E", fontSize: "0.9rem", marginBottom: 14 }}>
          Historial de reservas ({client.bookings.length})
        </div>
        {client.bookings.length === 0 ? (
          <div style={{ color: "#8888aa", fontSize: "0.88rem" }}>Sin reservas aún.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {client.bookings.map(b => (
              <div key={b.id} style={{ borderRadius: 10, border: "1px solid #f0f2f8", padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.87rem", color: "#1A1A2E" }}>{formatDate(b.date)}</span>
                  <span style={{
                    fontSize: "0.73rem", fontWeight: 700, borderRadius: 99, padding: "2px 10px",
                    background: STATUS_COLOR[b.status] + "22", color: STATUS_COLOR[b.status],
                  }}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>
                <div style={{ fontSize: "0.83rem", color: "#4A4A6A" }}>
                  {b.startTime} – {b.endTime} hs · {b.service.name} · {formatPrice(b.service.price)}
                </div>
                {b.notes && (
                  <div style={{ fontSize: "0.78rem", color: "#8888aa", marginTop: 3 }}>📝 {b.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
