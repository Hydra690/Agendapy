"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import PlanUpsell from "../components/PlanUpsell";

interface Review {
  id: string;
  reviewerName: string;
  text: string;
  rating: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: "0.95rem", letterSpacing: "0.05em" }}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("es-PY", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReviewsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/dashboard/reviews")
      .then(r => {
        if (r.status === 403) { setLocked(true); return null; }
        return r.json() as Promise<{ reviews: Review[] }>;
      })
      .then(data => { if (data) setReviews(data.reviews ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  async function moderate(id: string, action: "APPROVE" | "REJECT") {
    setActionId(id);
    try {
      const res = await fetch("/api/dashboard/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json() as { review: Review };
      if (res.ok) {
        setReviews(prev => prev.map(r => r.id === id ? data.review : r));
      }
    } catch { /* ignore */ }
    finally { setActionId(null); }
  }

  const pending = reviews.filter(r => r.status === "PENDING");
  const approved = reviews.filter(r => r.status === "APPROVED");
  const rejected = reviews.filter(r => r.status === "REJECTED");

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1A1A2E", marginBottom: 4 }}>Reseñas</h1>
        <p style={{ color: "#4A4A6A", fontSize: "0.88rem" }}>
          Aprobá o rechazá los testimonios que dejan tus clientes
        </p>
      </div>

      {loading ? (
        <div style={{ color: "#4A4A6A", fontSize: "0.9rem" }}>Cargando...</div>
      ) : locked ? (
        <PlanUpsell
          title="Las reseñas son una función del plan PRO"
          message="Recopilá y moderá los testimonios de tus clientes, y mostralos en tu página pública. Activá el plan PRO para habilitarlas."
        />
      ) : reviews.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 16, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>⭐</div>
          <div style={{ fontWeight: 700, color: "#1A1A2E", marginBottom: 6 }}>Sin reseñas aún</div>
          <p style={{ color: "#4A4A6A", fontSize: "0.88rem" }}>Cuando tus clientes dejen testimonios, aparecerán aquí para que puedas moderarlos.</p>
        </div>
      ) : (
        <>
          {/* Pendientes */}
          {pending.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontWeight: 700, color: "#1A1A2E", fontSize: "0.95rem" }}>Pendientes de revisión</span>
                <span style={{ background: "#fef3c7", color: "#b45309", borderRadius: 99, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700 }}>
                  {pending.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pending.map(r => (
                  <div key={r.id} style={{ background: "#fff", border: "1.5px solid #ffe082", borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, color: "#1A1A2E", fontSize: "0.92rem" }}>{r.reviewerName}</span>
                      <Stars rating={r.rating} />
                      <span style={{ fontSize: "0.75rem", color: "#8888aa", marginLeft: "auto" }}>{formatDate(r.createdAt)}</span>
                    </div>
                    <p style={{ margin: "0 0 12px", fontSize: "0.87rem", color: "#4A4A6A", lineHeight: 1.6 }}>{r.text}</p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => moderate(r.id, "APPROVE")}
                        disabled={actionId === r.id}
                        style={{
                          background: "#00c48c", color: "#fff", border: "none", borderRadius: 8,
                          padding: "6px 16px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                        }}
                      >
                        {actionId === r.id ? "..." : "✓ Aprobar"}
                      </button>
                      <button
                        onClick={() => moderate(r.id, "REJECT")}
                        disabled={actionId === r.id}
                        style={{
                          background: "#fff", color: "#ef4444", border: "1.5px solid #ef4444", borderRadius: 8,
                          padding: "6px 16px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                        }}
                      >
                        ✕ Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aprobadas */}
          {approved.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontWeight: 700, color: "#1A1A2E", fontSize: "0.95rem" }}>Aprobadas y visibles</span>
                <span style={{ background: "#e8fff6", color: "#00c48c", borderRadius: 99, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700 }}>
                  {approved.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {approved.map(r => (
                  <div key={r.id} style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 14, padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: "#1A1A2E", fontSize: "0.88rem" }}>{r.reviewerName}</span>
                      <Stars rating={r.rating} />
                      <span style={{ fontSize: "0.72rem", color: "#8888aa", marginLeft: "auto" }}>{formatDate(r.createdAt)}</span>
                    </div>
                    <p style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "#4A4A6A", lineHeight: 1.6 }}>{r.text}</p>
                    <button
                      onClick={() => moderate(r.id, "REJECT")}
                      disabled={actionId === r.id}
                      style={{
                        background: "none", color: "#8888aa", border: "none",
                        fontSize: "0.75rem", cursor: "pointer", padding: 0,
                      }}
                    >
                      Ocultar reseña
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rechazadas */}
          {rejected.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontWeight: 700, color: "#8888aa", fontSize: "0.9rem" }}>Rechazadas ({rejected.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rejected.map(r => (
                  <div key={r.id} style={{ background: "#f9fafb", border: "1px solid #e8eaf0", borderRadius: 12, padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: "#8888aa", fontSize: "0.85rem" }}>{r.reviewerName}</span>
                      <Stars rating={r.rating} />
                    </div>
                    <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "#8888aa", lineHeight: 1.5 }}>{r.text}</p>
                    <button
                      onClick={() => moderate(r.id, "APPROVE")}
                      disabled={actionId === r.id}
                      style={{
                        background: "none", color: "#00c48c", border: "none",
                        fontSize: "0.75rem", cursor: "pointer", padding: 0, fontWeight: 600,
                      }}
                    >
                      Aprobar esta reseña
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
