import { useState, type CSSProperties } from 'react'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../data/segments'

type CarStyle = CSSProperties & { '--road-path': string }

const primaryPoints: [number, number][] = [
  [300, 500], [600, 200], [2500, 200], [2564, 136], [3926, 136],
  [4649, 859], [4649, 1491], [4517, 1623], [2067, 1623], [2004, 1560],
  [1516, 1560], [893, 2183], [847, 2183], [300, 1636],
]
const primaryPath = `M ${primaryPoints.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`

const secondaryPoints: [number, number][] = [
  [2018, 1977], [2046, 1949], [4635, 1949], [4859, 2173],
  [4859, 2303], [4664, 2498], [2243, 2498], [2018, 2273],
]
const secondaryPath = `M ${secondaryPoints.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`

// Houses now sit directly beside the road — offset just far enough to
// clear the road stroke, no connecting driveway line.
const houses: [number, number][] = [
  [200, 500],   // browse
  [2500, 100],  // properties
  [3997, 65],   // bookings
  [4749, 1491], // settings
  [2067, 1723], // home
  [1445, 1631], // messages
  [776, 2254],  // wallet
]

function useRandomDelay(durationSeconds: number) {
  const [delay] = useState(() => `-${(Math.random() * durationSeconds).toFixed(2)}s`)
  return delay
}

export default function WorldBackground() {
  const delayA = useRandomDelay(20)
  const delayB = useRandomDelay(22)
  const delayLoop = useRandomDelay(14)
  const delayC = useRandomDelay(25)
  const delayD = useRandomDelay(30)
  const delayE = useRandomDelay(24)

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none"
      style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT }}
    >
      <svg width={WORLD_WIDTH} height={WORLD_HEIGHT} className="absolute top-0 left-0">
        <rect width={WORLD_WIDTH} height={WORLD_HEIGHT} fill="#f4f5f0" />

        <path d={primaryPath} fill="none" stroke="#ffffff" strokeWidth="34" strokeLinejoin="round" strokeLinecap="round" />
        <path d={secondaryPath} fill="none" stroke="#ffffff" strokeWidth="28" strokeLinejoin="round" strokeLinecap="round" />

        {houses.map(([hx, hy], i) => (
          <g key={i}>
            <rect x={hx - 55} y={hy - 35} width="110" height="70" rx="8" fill="#dcdcd4" stroke="#ffffff" strokeWidth="3" />
            <g transform={`translate(${hx}, ${hy})`}>
              <rect x="-22" y="-22" width="44" height="44" rx="10" fill="#f4a340" stroke="white" strokeWidth="4" />
              <circle cx="0" cy="-4" r="6" fill="white" />
            </g>
          </g>
        ))}
      </svg>

      <div className="car" style={{ '--road-path': `path('${primaryPath}')`, animationDuration: '53s', animationDelay: delayA, background: '#4a9e4a', animationName: 'driveA' } as CarStyle} />
      <div className="car" style={{ '--road-path': `path('${primaryPath}')`, animationDuration: '50s', animationDelay: delayB, background: '#e05d44', animationName: 'driveB' } as CarStyle} />
      <div className="car" style={{ '--road-path': `path('${secondaryPath}')`, animationDuration: '55s', animationDelay: delayLoop, background: '#3fa7c4', animationName: 'driveLoop' } as CarStyle} />
      <div className="car" style={{ '--road-path': `path('${secondaryPath}')`, animationDuration: '46s', animationDelay: delayC, background: '#e79c3a', animationName: 'driveLoop' } as CarStyle} />
      <div className="car" style={{ '--road-path': `path('${primaryPath}')`, animationDuration: '51s', animationDelay: delayD, background: '#8149e9', animationName: 'driveB' } as CarStyle} />
      <div className="car" style={{ '--road-path': `path('${primaryPath}')`, animationDuration: '45s', animationDelay: delayE, background: '#ff4fb5', animationName: 'driveA' } as CarStyle} />

      <style>{`
        .car {
          position: absolute;
          top: 0;
          left: 0;
          width: 26px;
          height: 16px;
          border-radius: 4px;
          offset-path: var(--road-path);
          offset-rotate: auto;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes driveA {
          0%   { offset-distance: 0%; }
          20%  { offset-distance: 20.2%; }
          28%  { offset-distance: 20.2%; }
          70%  { offset-distance: 70.3%; }
          78%  { offset-distance: 70.3%; }
          100% { offset-distance: 100%; }
        }

        @keyframes driveB {
          0%   { offset-distance: 0%; }
          33%  { offset-distance: 32.9%; }
          41%  { offset-distance: 32.9%; }
          83%  { offset-distance: 83.4%; }
          91%  { offset-distance: 83.4%; }
          100% { offset-distance: 100%; }
        }

        @keyframes driveLoop {
          0%   { offset-distance: 0%; }
          100% { offset-distance: 100%; }
        }
      `}</style>
    </div>
  )
}