/**
 * Date helpers shared by the booking flow and the public search bar.
 *
 * That sharing is deliberate: the search bar predicts which end date a booking
 * will use, so if the two ever disagreed people would see places that then
 * reject their dates at checkout.
 */

/** Today as YYYY-MM-DD in the browser's local time (used for `min` attributes). */
export function getTodayString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Adds whole months to a YYYY-MM-DD date, returning '' for invalid input. */
export function computeEndDate(startDateStr: string, months: number): string {
  if (!startDateStr || months < 1) return ''
  const [year, month, day] = startDateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  if (Number.isNaN(d.getTime())) return ''
  d.setMonth(d.getMonth() + months)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dt = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dt}`
}
