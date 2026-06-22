import { ImageResponse } from "next/og";

// OG image generada por código (next/og). Evita depender de un PNG binario y se
// genera estáticamente en build. Aplica a la home; las páginas de negocio (/[slug])
// usan su propia portada/logo vía generateMetadata.
export const alt = "Agendapy — Turnos online para tu negocio en Paraguay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0F1729 0%, #1A1A2E 60%, #0B3D2E 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
          padding: "80px",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, letterSpacing: "-2px" }}>
          <span>agenda</span>
          <span style={{ color: "#00C48C" }}>py</span>
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            marginTop: 40,
            lineHeight: 1.15,
            maxWidth: 900,
            letterSpacing: "-1px",
          }}
        >
          Tus clientes reservan solos. Vos trabajás tranquilo.
        </div>
        <div style={{ fontSize: 30, color: "#A7B0C0", marginTop: 32 }}>
          Turnos online para tu negocio en Paraguay 🇵🇾
        </div>
      </div>
    ),
    { ...size }
  );
}
