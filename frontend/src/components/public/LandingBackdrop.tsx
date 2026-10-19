/**
 * The public site's light and dark surfaces both derive from the same CSS
 * variables the in-app world map paints with (see index.css), so the landing
 * pages read as the same product instead of a bolted-on marketing site.
 */
export default function LandingBackdrop() {
  const houses: [number, number][] = [
    [190, 430],
    [520, 200],
    [980, 200],
    [1140, 470],
  ]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg
        className="h-full w-full"
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="1200" height="600" className="map-land" />

        <path
          d="M -60 470 L 300 470 L 520 250 L 900 250 L 1260 0"
          fill="none"
          className="map-road"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 1260 520 L 820 520 L 640 340"
          fill="none"
          className="map-road"
          strokeWidth="24"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {houses.map(([x, y], i) => (
          <g key={i}>
            <rect
              x={x - 55}
              y={y - 35}
              width="110"
              height="70"
              rx="8"
              className="map-house"
              strokeWidth="3"
            />
            <g transform={`translate(${x}, ${y})`}>
              <rect x="-22" y="-22" width="44" height="44" rx="10" fill="#f4a340" stroke="white" strokeWidth="4" />
              <circle cx="0" cy="-4" r="6" fill="white" />
            </g>
          </g>
        ))}
      </svg>
    </div>
  )
}
