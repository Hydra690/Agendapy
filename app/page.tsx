import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import styles from "./landing.module.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const FEATURES = [
  {
    icon: "📅",
    title: "Reservas en tiempo real",
    desc: "Tus clientes reservan desde su celular, sin llamadas ni mensajes de WhatsApp para coordinar.",
  },
  {
    icon: "⚙️",
    title: "Tu panel de control",
    desc: "Gestioná servicios, horarios y reservas desde un dashboard simple y fácil de usar.",
  },
  {
    icon: "🔗",
    title: "Tu página personalizada",
    desc: "Cada negocio recibe su propia URL pública, lista para compartir en redes o WhatsApp.",
  },
  {
    icon: "📲",
    title: "Integración con WhatsApp",
    desc: "Tus clientes pueden contactarte directamente desde su reserva confirmada.",
  },
];

const CATEGORIES = [
  "Barbería",
  "Salón de belleza",
  "Veterinaria",
  "Psicología",
  "Odontología",
  "Médico",
  "Fitness",
  "Fotografía",
  "Masajes",
  "Clases particulares",
  "y más...",
];

export default function LandingPage() {
  return (
    <div className={`${jakarta.className} ${styles.root}`}>
      {/* NAVBAR */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo}>
            agenda<span className={styles.logoAccent}>py</span>
          </Link>
          <div className={styles.navRight}>
            <Link href="/login" className={styles.navLogin}>Iniciar sesión</Link>
            <Link href="/register" className={styles.navRegister}>Empezar gratis</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.heroBadge}>Para negocios en Paraguay 🇵🇾</span>
          <h1 className={styles.heroTitle}>
            Reservas online<br />para tu negocio
          </h1>
          <p className={styles.heroSub}>
            Creá tu página de turnos en minutos. Tus clientes reservan solos —
            vos te enfocás en trabajar.
          </p>
          <div className={styles.heroActions}>
            <Link href="/register" className={styles.btnPrimary}>Empezar gratis →</Link>
            <a
              href="/barberia-demo"
              className={styles.btnOutline}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver demo
            </a>
          </div>
          <p className={styles.heroNote}>Sin tarjeta de crédito · Listo en 5 minutos</p>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className={styles.catsSection}>
        <div className={styles.container}>
          <p className={styles.catsLabel}>Perfecto para</p>
          <div className={styles.catsList}>
            {CATEGORIES.map((cat) => (
              <span key={cat} className={styles.catChip}>{cat}</span>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Empezá en 3 pasos</h2>
          <p className={styles.sectionSub}>
            Sin configuraciones complicadas. Sin conocimientos técnicos.
          </p>
          <div className={styles.stepsGrid}>
            {[
              {
                n: "1",
                title: "Creá tu cuenta",
                desc: "Registrate gratis y configurá los datos de tu negocio: nombre, categoría y horarios de atención.",
              },
              {
                n: "2",
                title: "Agregá tus servicios",
                desc: "Definí qué ofrecés, la duración y el precio. Podés tener tantos servicios como necesités.",
              },
              {
                n: "3",
                title: "Compartí tu link",
                desc: "Tu URL personalizada como agendapy.com/tu-negocio está lista para compartir con tus clientes.",
              },
            ].map((step) => (
              <div key={step.n} className={styles.stepCard}>
                <div className={styles.stepNumber}>{step.n}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={`${styles.section} ${styles.sectionGray}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Todo lo que necesitás</h2>
          <p className={styles.sectionSub}>
            Una solución completa para gestionar los turnos de tu negocio.
          </p>
          <div className={styles.featGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featCard}>
                <div className={styles.featIcon}>{f.icon}</div>
                <h3 className={styles.featTitle}>{f.title}</h3>
                <p className={styles.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <h2 className={styles.ctaTitle}>¿Listo para recibir reservas?</h2>
          <p className={styles.ctaSub}>
            Creá tu cuenta gratis y empezá a recibir turnos hoy mismo.
          </p>
          <Link href="/register" className={styles.btnPrimaryLg}>
            Crear cuenta gratis →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Link href="/" className={styles.footerLogo}>
            agenda<span className={styles.logoAccent}>py</span>
          </Link>
          <p className={styles.footerCopy}>© 2026 Agendapy. Hecho en Paraguay.</p>
        </div>
      </footer>
    </div>
  );
}
