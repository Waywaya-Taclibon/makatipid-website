/**
 * The public site's light and dark surfaces both derive from the same CSS
 * variables the in-app world map paints with (see index.css), so the landing
 * pages read as the same product instead of a bolted-on marketing site.
 *
 * Cars are animated with SVG <animateMotion> rather than CSS offset-path: the
 * backdrop is scaled and cropped by preserveAspectRatio, and only motion inside
 * the SVG coordinate system stays aligned with the roads at every screen size.
 */

const mainRoad = 'M -60 470 L 300 470 L 520 250 L 900 250 L 1260 0'
const sideRoad = 'M 1260 520 L 820 520 L 640 340'

interface Car {
  path: string
  color: string
  duration: string
  begin: string
}

// Same palette and dimensions as WorldBackground, so the two surfaces read as
// the same place. Negative begin values stagger cars mid-route on first paint.
const cars: Car[] = [
  { path: mainRoad, color: '#4a9e4a', duration: '30s', begin: '0s' },
  { path: mainRoad, color: '#e05d44', duration: '38s', begin: '-14s' },
  { path: mainRoad, color: '#8149e9', duration: '34s', begin: '-24s' },
  { path: sideRoad, color: '#3fa7c4', duration: '18s', begin: '-4s' },
  { path: sideRoad, color: '#e79c3a', duration: '22s', begin: '-13s' },
]

export default function LandingBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg
        className="h-full w-full"
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="1200" height="600" className="map-land" />

        <path
          d={mainRoad}
          fill="none"
          className="map-road"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={sideRoad}
          fill="none"
          className="map-road"
          strokeWidth="24"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {cars.map((car, index) => (
          <g key={index}>
            <rect x="-13" y="-8" width="26" height="16" rx="4" fill={car.color} />
            <animateMotion
              path={car.path}
              dur={car.duration}
              begin={car.begin}
              repeatCount="indefinite"
              rotate="auto"
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
