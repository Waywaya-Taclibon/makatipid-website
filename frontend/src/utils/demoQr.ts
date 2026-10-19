/**
 * A decorative stand-in for a PayMongo QR code.
 *
 * The demo never contacts PayMongo, so there is no real code to show. This
 * renders a deterministic pseudo-QR (same seed → same picture) as an inline SVG
 * data URL, so the existing `<img>` slot and blur/reveal UI keep working while
 * the design still reads as "a QR code". It is deliberately not scannable.
 */
export function mockQrDataUrl(seed: string): string {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const rand = () => {
    hash ^= hash << 13
    hash ^= hash >>> 17
    hash ^= hash << 5
    return ((hash >>> 0) % 1000) / 1000
  }

  const cells = 25
  const cell = 12
  const dim = cells * cell
  const rects: string[] = []
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      if (rand() > 0.52) {
        rects.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`)
      }
    }
  }
  // Finder squares in the three QR corners for instant recognisability.
  const finder = (x: number, y: number) =>
    `<rect x="${x * cell}" y="${y * cell}" width="${cell * 7}" height="${cell * 7}"/>` +
    `<rect x="${(x + 1) * cell}" y="${(y + 1) * cell}" width="${cell * 5}" height="${cell * 5}" fill="#fff"/>` +
    `<rect x="${(x + 2) * cell}" y="${(y + 2) * cell}" width="${cell * 3}" height="${cell * 3}"/>`

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<g fill="#0f172a">${rects.join('')}${finder(0, 0)}${finder(cells - 7, 0)}${finder(0, cells - 7)}</g>` +
    `<rect x="0" y="${dim / 2 - 15}" width="${dim}" height="30" fill="#ffffff"/>` +
    `<text x="50%" y="${dim / 2 + 9}" text-anchor="middle" font-family="system-ui, sans-serif" ` +
    `font-size="22" font-weight="700" fill="#e05d44">DEMO</text>` +
    `</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
