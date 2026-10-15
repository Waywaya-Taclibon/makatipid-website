// Port of PaymentService wholeMonths + rangesOverlap (day granularity, null end = ongoing).
function wholeMonths(start, end) {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() > start.getDate()) months += 1;
  // Same start/end day => Period.days == 0 => 0 months here, floored to min 1 below.
  return Math.max(months, 1);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  if (aEnd && aEnd < bStart) return false;
  if (bEnd && bEnd < aStart) return false;
  return true;
}

function parseDateOnly(value) {
  if (value == null || value === '') return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateOnlyString(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayDateOnly() {
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return n;
}

module.exports = { wholeMonths, rangesOverlap, parseDateOnly, toDateOnlyString, todayDateOnly };
