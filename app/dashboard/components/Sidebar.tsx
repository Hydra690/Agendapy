"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import styles from "../dashboard.module.css";

interface Business { name: string; slug: string; }

export default function Sidebar() {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [business, setBusiness] = useState<Business | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/dashboard/business")
      .then(r => { if (r.status === 404) { router.push("/onboarding"); return null; } return r.json() as Promise<{ business: Business }>; })
      .then(data => { if (data) setBusiness(data.business); })
      .catch(() => {});
  }, [status, router]);

  const isReservas = pathname === "/dashboard";
  const isServicios = pathname.startsWith("/dashboard/services");
  const isStaff = pathname.startsWith("/dashboard/staff");
  const isClientes = pathname.startsWith("/dashboard/clients");
  const isReviews = pathname.startsWith("/dashboard/reviews");
  const isConfig = pathname.startsWith("/dashboard/settings");

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.sidebarLogo}>
        agenda<span className={styles.sidebarLogoAccent}>py</span>
      </Link>

      {business && (
        <div className={styles.sidebarBiz}>
          <div className={styles.sidebarBizName}>{business.name}</div>
          <div className={styles.sidebarBizSlug}>/{business.slug}</div>
        </div>
      )}

      <nav className={styles.nav}>
        <Link
          href="/dashboard"
          className={`${styles.navItem} ${isReservas ? styles.navItemActive : ""}`}
        >
          📅 Reservas
        </Link>
        <Link
          href="/dashboard/services"
          className={`${styles.navItem} ${isServicios ? styles.navItemActive : ""}`}
        >
          🛠️ Servicios
        </Link>
        <Link
          href="/dashboard/staff"
          className={`${styles.navItem} ${isStaff ? styles.navItemActive : ""}`}
        >
          ✂️ Profesionales
        </Link>
        <Link
          href="/dashboard/clients"
          className={`${styles.navItem} ${isClientes ? styles.navItemActive : ""}`}
        >
          👥 Clientes
        </Link>
        <Link
          href="/dashboard/reviews"
          className={`${styles.navItem} ${isReviews ? styles.navItemActive : ""}`}
        >
          ⭐ Reseñas
        </Link>
        <Link
          href="/dashboard/settings"
          className={`${styles.navItem} ${isConfig ? styles.navItemActive : ""}`}
        >
          ⚙️ Configuración
        </Link>
      </nav>

      <div className={styles.sidebarBottom}>
        {business && (
          <a
            href={`/${business.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnViewPage}
          >
            🔗 Ver mi página
          </a>
        )}
        <button
          className={styles.btnLogout}
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          ↩ Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
