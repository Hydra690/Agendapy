import { Plus_Jakarta_Sans } from "next/font/google";
import Sidebar from "./components/Sidebar";
import styles from "./dashboard.module.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${jakarta.className} ${styles.shell}`}>
      <Sidebar />
      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
