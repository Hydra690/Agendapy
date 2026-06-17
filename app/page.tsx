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
    title: "Reservas online 24/7",
    desc: "Tus clientes reservan desde el celular a cualquier hora, sin llamadas ni idas y vueltas por WhatsApp.",
  },
  {
    icon: "👥",
    title: "Agenda por profesional",
    desc: "Cada persona de tu equipo tiene su propia agenda y servicios. El cliente elige con quién o deja que asignemos a quien esté libre.",
  },
  {
    icon: "🔔",
    title: "Recordatorios por WhatsApp",
    desc: "Aviso automático al cliente 24 h antes del turno y notificación a vos en cada reserva nueva. Menos ausencias.",
  },
  {
    icon: "⚙️",
    title: "Tu panel de control",
    desc: "Gestioná servicios, horarios, turnos partidos y días bloqueados desde un dashboard simple y fácil de usar.",
  },
  {
    icon: "⭐",
    title: "Reseñas y métricas",
    desc: "Recibí reseñas de tus clientes y mirá tus números: ingresos, hora pico y servicio más pedido.",
  },
  {
    icon: "🔗",
    title: "Tu página personalizada",
    desc: "Cada negocio recibe su URL pública (agendapy.com.py/tu-negocio), lista para compartir en redes o WhatsApp.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "Gs. 0",
    priceNote: "Para siempre",
    featured: false,
    cta: { label: "Empezar gratis", href: "/register" },
    features: [
      "Reservas online ilimitadas",
      "Tu página pública personalizada",
      "Panel de control",
      "Hasta 2 servicios",
      "Aviso de reservas por WhatsApp",
    ],
  },
  {
    name: "Basic",
    price: "Consultá",
    priceNote: "Todo lo de Free, y más",
    featured: false,
    cta: { label: "Consultar", href: "mailto:hola@agendapy.com.py?subject=Quiero el plan Basic" },
    features: [
      "Servicios ilimitados",
      "Recordatorios automáticos 24 h",
      "Métricas y estadísticas",
      "Historial y notas de clientes",
      "Exportá tus reservas a CSV",
    ],
  },
  {
    name: "Pro",
    price: "Consultá",
    priceNote: "Todo lo de Basic, y más",
    featured: true,
    cta: { label: "Consultar", href: "mailto:hola@agendapy.com.py?subject=Quiero el plan Pro" },
    features: [
      "Agenda multi-profesional (tu equipo)",
      "Reseñas de clientes",
      "Analítica de retención de clientes",
    ],
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
            <a href="#planes" className={styles.navLogin}>Planes</a>
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
                desc: "Tu URL personalizada como agendapy.com.py/tu-negocio está lista para compartir con tus clientes.",
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

      {/* PLANS */}
      <section id="planes" className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Planes para cada etapa</h2>
          <p className={styles.sectionSub}>
            Empezá gratis y pasá a un plan pago cuando tu negocio lo necesite.
          </p>
          <div className={styles.plansGrid}>
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`${styles.planCard} ${plan.featured ? styles.planCardFeatured : ""}`}
              >
                {plan.featured && <span className={styles.planBadge}>Más completo</span>}
                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.planPrice}>{plan.price}</div>
                <p className={styles.planPriceNote}>{plan.priceNote}</p>
                <ul className={styles.planFeatures}>
                  {plan.features.map((feat) => (
                    <li key={feat} className={styles.planFeature}>
                      <span className={styles.planCheck}>✓</span> {feat}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.cta.href}
                  className={plan.featured ? styles.planCtaPrimary : styles.planCtaGhost}
                >
                  {plan.cta.label}
                </a>
              </div>
            ))}
          </div>
          <p className={styles.plansNote}>
            ¿Dudas sobre qué plan te conviene? Escribinos a{" "}
            <a href="mailto:hola@agendapy.com.py" className={styles.plansLink}>hola@agendapy.com.py</a>
          </p>
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
