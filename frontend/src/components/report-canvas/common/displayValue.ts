// Match the canvas export without converting hospital wall-clock dates to another timezone.
export function displayCanvasValue(value: unknown): string {
  if (value == null || (typeof value === "string" && !value.trim())) return "—";
  const text = String(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(text);
  if (!iso) return text;
  const [, year, month, day, hour, minute, second, fraction] = iso;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text.slice(0, 10) ||
      (hour != null && (+hour > 23 || +minute > 59 || +(second || 0) > 59))) return text;
  const hasTime = +(hour || 0) || +(minute || 0) || +(second || 0) || +(fraction || 0);
  return `${day}/${month}/${year}${hasTime ? ` ${hour}:${minute}` : ""}`;
}
