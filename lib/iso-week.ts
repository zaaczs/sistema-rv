/** Segunda-feira 00:00 da semana ISO 1 do ano ISO `isoYear`. */
function mondayOfIsoWeek1(isoYear: number): Date {
  const jan4 = new Date(isoYear, 0, 4);
  const dow = jan4.getDay();
  const isoDow = dow === 0 ? 7 : dow;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (isoDow - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Intervalo [start, end] da semana ISO `week` (1–53) no ano ISO `isoYear` (horário local). */
export function isoWeekRange(isoYear: number, week: number): { start: Date; end: Date } {
  const w1 = mondayOfIsoWeek1(isoYear);
  const start = new Date(w1);
  start.setDate(w1.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Segunda-feira (calendário local) da semana que contém `d`. */
export function mondayOfLocalWeekContaining(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

/** Ano ISO e número da semana ISO para a data `d` (local). */
export function getIsoWeekAndYear(d: Date): { isoYear: number; week: number } {
  const mon = mondayOfLocalWeekContaining(d);
  const thu = new Date(mon);
  thu.setDate(mon.getDate() + 3);
  thu.setHours(12, 0, 0, 0);
  const isoYear = thu.getFullYear();
  const w1 = mondayOfIsoWeek1(isoYear);
  const week = Math.round((mon.getTime() - w1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { isoYear, week: Math.max(1, week) };
}

/** Quantidade de semanas ISO no ano (52 ou 53). */
export function isoWeeksInYear(isoYear: number): number {
  return getIsoWeekAndYear(new Date(isoYear, 11, 28)).week;
}

/** Semana anterior à (`isoYear`, `week`). */
export function previousIsoWeek(isoYear: number, week: number): { isoYear: number; week: number } {
  if (week > 1) return { isoYear, week: week - 1 };
  const prevY = isoYear - 1;
  return { isoYear: prevY, week: isoWeeksInYear(prevY) };
}
