// Formatters de la página pública de reservas (wizard + modales).
// Re-exporta los helpers compartidos de lib/format con los nombres locales que ya
// usan los componentes, para no duplicar la lógica (vive en un solo lugar).

export {
  formatGs as formatPrice,
  formatDayMonthYear as formatDate,
  todayISO,
} from "@/lib/format";
