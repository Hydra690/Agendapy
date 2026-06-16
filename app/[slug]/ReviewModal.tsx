"use client";

import { useState } from "react";
import styles from "./booking.module.css";

// Modal para dejar un testimonio. Encapsula su propio estado de formulario y envío;
// el padre solo controla cuándo se monta (open) y el cierre (onClose). Al montarse
// fresco en cada apertura, el estado arranca limpio sin necesidad de resets externos.
export default function ReviewModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [form, setForm] = useState({ reviewerName: "", text: "", rating: 5 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Error al enviar."); return; }
      setDone(true);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={() => !submitting && onClose()}>
      <div className={styles.myBookingsModal} onClick={e => e.stopPropagation()}>
        <div className={styles.myBookingsModalHeader}>
          <h3 className={styles.myBookingsModalTitle}>Dejar un testimonio</h3>
          <button className={styles.myBookingsClose} onClick={onClose}>✕</button>
        </div>
        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🙏</div>
            <p style={{ fontWeight: 700, color: "#1A1A2E", marginBottom: 6 }}>¡Gracias por tu opinión!</p>
            <p style={{ fontSize: "0.85rem", color: "#4A4A6A" }}>Tu testimonio será visible una vez que sea aprobado.</p>
            <button className={styles.myBookingsSearchBtn} style={{ marginTop: 16 }} onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "4px 0" }}>
            <p className={styles.myBookingsModalSub}>Tu opinión ayuda a otros clientes a elegir</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#4A4A6A", display: "block", marginBottom: 5 }}>Tu nombre *</label>
              <input
                type="text"
                className={styles.myBookingsInput}
                placeholder="Ej: Juan Pérez"
                value={form.reviewerName}
                onChange={e => setForm(f => ({ ...f, reviewerName: e.target.value }))}
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
                    onClick={() => setForm(f => ({ ...f, rating: n }))}
                    style={{
                      fontSize: "1.6rem",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: n <= form.rating ? "#f59e0b" : "#d1d5db",
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
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                required
                minLength={10}
                maxLength={500}
                rows={3}
              />
              <span style={{ fontSize: "0.75rem", color: "#8888aa" }}>{form.text.length}/500</span>
            </div>

            {error && <div className={styles.myBookingsError}>{error}</div>}

            <div className={styles.myBookingsSearch}>
              <button
                type="submit"
                className={styles.myBookingsSearchBtn}
                style={{ width: "100%" }}
                disabled={submitting || !form.reviewerName.trim() || form.text.trim().length < 10}
              >
                {submitting ? "Enviando..." : "Enviar testimonio"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
