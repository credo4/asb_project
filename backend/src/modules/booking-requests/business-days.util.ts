// Délai de réponse (SLA) par service — cf. cahier des charges §6.
// En JOURS OUVRÉS : on avance jour par jour et on ignore samedi/dimanche.
export function addBusinessDays(from: Date, businessDays: number): Date {
  const result = new Date(from);
  let remaining = businessDays;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay(); // 0 = dimanche, 6 = samedi
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining -= 1;
    }
  }

  return result;
}
