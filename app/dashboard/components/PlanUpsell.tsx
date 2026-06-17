// Tarjeta de upsell reutilizable para cuando una feature requiere un plan superior.
// El CTA es un mailto (no es navegación a una página interna), así que no rompe la
// regla de lint no-html-link-for-pages.

export default function PlanUpsell({ title, message }: { title: string; message: string }) {
  return (
    <div style={{
      background: "#fff",
      border: "1.5px solid #ffe082",
      borderRadius: 16,
      padding: "44px 32px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔒</div>
      <div style={{ fontWeight: 800, color: "#1A1A2E", marginBottom: 6, fontSize: "1.05rem" }}>{title}</div>
      <p style={{ color: "#4A4A6A", fontSize: "0.88rem", maxWidth: 420, margin: "0 auto 18px", lineHeight: 1.6 }}>
        {message}
      </p>
      <a
        href="mailto:hola@agendapy.com.py?subject=Quiero contratar el plan"
        style={{
          background: "#f59e0b",
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.85rem",
          borderRadius: 8,
          padding: "9px 20px",
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        Contratar plan
      </a>
    </div>
  );
}
