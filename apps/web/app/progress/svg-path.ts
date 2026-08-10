// Turns a numeric series into an SVG path `d` string. Presentational math
// specific to this chart's rendering, not domain logic — colocated here
// rather than lib/ (code-conventions.md: lib/ is for business logic).
// Carried over from the progress-charts prototype (variant D), unchanged.

export function seriesToPath(
  values: number[],
  width: number,
  height: number,
  padding = 4,
  range?: { min: number; max: number },
): string {
  if (values.length === 0) return "";
  const min = range?.min ?? Math.min(...values);
  const max = range?.max ?? Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - padding * 2) / (values.length - 1 || 1);
  const points = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((v - min) / span) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${points.join(" L ")}`;
}
