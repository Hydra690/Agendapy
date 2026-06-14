import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export default function NotFound() {
  return (
    <div
      className={jakarta.className}
      style={{
        minHeight: "100dvh",
        background: "#F5F7FA",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div
          style={{
            fontSize: "1.6rem",
            fontWeight: 800,
            color: "#1A1A2E",
            marginBottom: 36,
            letterSpacing: "-0.5px",
          }}
        >
          agenda<span style={{ color: "#00C48C" }}>py</span>
        </div>

        <div style={{ fontSize: "3.5rem", marginBottom: 24 }}>🔍</div>

        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "#1A1A2E",
            margin: "0 0 12px",
            letterSpacing: "-0.3px",
          }}
        >
          Esta página no existe
        </h1>

        <p
          style={{
            color: "#4A4A6A",
            fontSize: "0.95rem",
            lineHeight: 1.6,
            margin: "0 0 36px",
          }}
        >
          Si buscabas un negocio, verificá que el link sea correcto.
        </p>

        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "13px 32px",
            background: "#00C48C",
            color: "#fff",
            borderRadius: 10,
            fontWeight: 700,
            textDecoration: "none",
            fontSize: "0.95rem",
            transition: "background 0.15s",
          }}
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
