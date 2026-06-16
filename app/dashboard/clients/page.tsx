"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePlan } from "../usePlan";

interface Client {
  id: string;
  name: string;
  whatsapp: string | null;
  notes: string | null;
  createdAt: string;
  totalVisits: number;
  totalBookings: number;
  lastVisit: string | null;
  lastService: string | null;
}

function formatDate(isoStr: string): string {
  const part = isoStr.split("T")[0];
  const [y, m, d] = part.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PY", { day: "numeric", month: "short", year: "numeric" });
}

export default function ClientsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { can } = usePlan();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/dashboard/clients")
      .then(r => r.json() as Promise<{ clients: Client[] }>)
      .then(data => setClients(data.clients ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.whatsapp ?? "").includes(search)
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1A1A2E", marginBottom: 4 }}>Clientes</h1>
        <p style={{ color: "#4A4A6A", fontSize: "0.88rem" }}>
          Historial y ficha de cada cliente que reservó en tu negocio
        </p>
      </div>

      {loading ? (
        <div style={{ color: "#4A4A6A", fontSize: "0.9rem" }}>Cargando...</div>
      ) : clients.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 16, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>👥</div>
          <div style={{ fontWeight: 700, color: "#1A1A2E", marginBottom: 6 }}>Sin clientes aún</div>
          <p style={{ color: "#4A4A6A", fontSize: "0.88rem" }}>Cuando alguien haga una reserva, aparecerá aquí.</p>
        </div>
      ) : (
        <>
          {!can("clientsCrm") && (
            <div style={{
              background: "#fff8e1", border: "1.5px solid #ffe082", borderRadius: 12,
              padding: "10px 16px", marginBottom: 14, fontSize: "0.82rem", color: "#92400e",
            }}>
              La ficha y el historial de cada cliente son una función del plan. Activá un plan para acceder al detalle.
            </div>
          )}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o WhatsApp..."
            style={{
              width: "100%", padding: "10px 16px", borderRadius: 10,
              border: "1.5px solid #e8eaf0", fontSize: "0.9rem", marginBottom: 16,
              boxSizing: "border-box", outline: "none",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(c => (
              <a
                key={c.id}
                href={`/dashboard/clients/${c.id}`}
                style={{ textDecoration: "none" }}
              >
                <div style={{
                  background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 14,
                  padding: "14px 18px", display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 12, cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "#00c48c")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "#e8eaf0")}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#1A1A2E", fontSize: "0.95rem", marginBottom: 2 }}>{c.name}</div>
                    {c.whatsapp && (
                      <div style={{ fontSize: "0.8rem", color: "#4A4A6A" }}>📱 {c.whatsapp}</div>
                    )}
                    {c.lastService && (
                      <div style={{ fontSize: "0.78rem", color: "#8888aa", marginTop: 2 }}>
                        Último: {c.lastService}{c.lastVisit ? ` · ${formatDate(c.lastVisit)}` : ""}
                      </div>
                    )}
                    {c.notes && (
                      <div style={{ fontSize: "0.77rem", color: "#00c48c", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                        📝 {c.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "#00c48c" }}>{c.totalVisits}</div>
                    <div style={{ fontSize: "0.72rem", color: "#8888aa" }}>visitas</div>
                  </div>
                </div>
              </a>
            ))}
            {filtered.length === 0 && (
              <div style={{ color: "#8888aa", fontSize: "0.88rem", padding: "20px 0" }}>
                Sin resultados para &quot;{search}&quot;
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: "0.78rem", color: "#8888aa" }}>
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
          </div>
        </>
      )}
    </div>
  );
}
