import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { segments, WORLD_WIDTH, WORLD_HEIGHT } from '../data/segments'
import WorldBackground from './WorldBackground'
import PropertiesView from './PropertiesView'
import BrowseRentals from './BrowseRentals'
import Settings from './Settings'
import Bookings from './Bookings'

export default function WorldMap() {
  const location = useLocation()
  const navigate = useNavigate()
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })

  useEffect(() => {
    function updateTransform() {
      const current =
        segments.find((s) => s.path === location.pathname) ??
        segments.find((s) => s.id === 'home')!

      const viewportW = window.innerWidth
      const viewportH = window.innerHeight
      const padding = 1 // lower = more zoomed out, shows more of neighbors

      const scale = Math.min(
        (viewportW / current.width) * padding,
        (viewportH / current.height) * padding
      )

      const segmentCenterX = current.x + current.width / 2
      const segmentCenterY = current.y + current.height / 2

      setTransform({
        x: viewportW / 2 - segmentCenterX * scale,
        y: viewportH / 2 - segmentCenterY * scale,
        scale,
      })
    }

    updateTransform()
    window.addEventListener('resize', updateTransform)
    return () => window.removeEventListener('resize', updateTransform)
  }, [location.pathname])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white-900">

    {location.pathname !== '/' && (
      <button
        onClick={() => navigate('/')}
        className="fixed top-6 right-6 z-20 bg-white/95 backdrop-blur rounded-2xl shadow-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:shadow-2xl transition-shadow"
      >
        ← Dashboard
      </button>
    )}

      <div
        className="absolute top-0 left-0"
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          transition: 'transform 0.9s cubic-bezier(0.65, 0, 0.35, 1)',
        }}
      >
        <WorldBackground />

        {segments.map((segment) => (
          <div
            key={segment.id}
            className="absolute flex flex-col items-center justify-center p-12"
            style={{
              left: segment.x,
              top: segment.y,
              width: segment.width,
              height: segment.height,
            }}
          >
          {segment.id === 'properties' ? (
            <PropertiesView />
          ) : segment.id === 'browse' ? (
            <BrowseRentals />
          ) : segment.id === 'settings' ? (
            <Settings />
          ) : segment.id === 'bookings' ? (
            <Bookings />
          ) : (
            <>
              <h2 className="text-5xl font-bold text-slate-800 mb-8">{segment.title}</h2>

              {segment.id === 'home' ? (
                <div className="grid grid-cols-3 gap-6">
                  {segments
                    .filter((s) => s.id !== 'home')
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => navigate(s.path)}
                        className="bg-white rounded-xl px-8 py-6 text-xl font-semibold text-slate-700 shadow hover:shadow-lg hover:scale-105 transition-all"
                      >
                        {s.title}
                      </button>
                    ))}
                </div>
              ) : (
                <button
                  onClick={() => navigate('/')}
                  className="bg-white rounded-xl px-6 py-3 text-lg font-medium text-slate-700 shadow hover:shadow-lg transition-all"
                >
                  ← Back to Dashboard
                </button>
              )}
            </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}