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

// Asia/Manila "today" at midnight, independent of the server/DB time zone.
// Used for every "is this date in the past?" rule so local dev machines,
// servers, and MySQL (CURDATE()) can't disagree off-by-one.
function manilaTodayDateOnly() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // "YYYY-MM-DD"
  return parseDateOnly(parts);
}

function toDateTimeString(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const h = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  const s = String(dt.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

module.exports = { wholeMonths, rangesOverlap, parseDateOnly, toDateOnlyString, todayDateOnly, manilaTodayDateOnly, toDateTimeString };
