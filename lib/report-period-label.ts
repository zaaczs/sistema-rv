export function getReportPeriodLabel(input: {
  period: "weekly" | "monthly" | "quarterly" | "semiannual" | "annual";
  month: number;
  year: number;
  quarter: number;
  semester: number;
  isoYear: number;
  safeWeek: number;
}) {
  const { period, month, year, quarter, semester, isoYear, safeWeek } = input;

  if (period === "weekly") return `Semana ${safeWeek}/${isoYear}`;
  if (period === "monthly") return `${month}/${year}`;
  if (period === "quarterly") return `${quarter}º trimestre/${year}`;
  if (period === "semiannual") return `${semester}º semestre/${year}`;
  return `Ano ${year}`;
}
