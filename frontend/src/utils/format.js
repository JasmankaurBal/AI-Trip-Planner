import { format, parseISO, differenceInCalendarDays } from "date-fns";

export const money = (amount, currency = "USD") => {
  if (amount == null || isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(0)}`;
  }
};

export const fmtDate = (d, f = "MMM d, yyyy") => {
  if (!d) return "";
  try {
    return format(typeof d === "string" ? parseISO(d) : d, f);
  } catch {
    return String(d);
  }
};

export const dateRange = (start, end) => {
  if (!start || !end) return "";
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
  } catch {
    return `${start} – ${end}`;
  }
};

export const tripDays = (start, end) => {
  if (!start || !end) return 0;
  try {
    return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  } catch {
    return 0;
  }
};

export const minutesLabel = (m) => {
  if (!m) return "";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h ? `${h}h${min ? ` ${min}m` : ""}` : `${min}m`;
};

export const initials = (name = "") =>
  name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
