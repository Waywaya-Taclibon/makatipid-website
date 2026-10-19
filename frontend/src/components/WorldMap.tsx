import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { segments, WORLD_WIDTH, WORLD_HEIGHT } from '../data/segments'
import WorldBackground from './WorldBackground'
import PropertiesView from './PropertiesView'
import BrowseRentals from './BrowseRentals'
import Settings from './Settings'
import Bookings from './Bookings'
import Messages from './Messages'
import { useUnreadMessages } from '../hooks/useUnreadMessages'

// Where the camera must sit to centre the section for `pathname`, in pixels.
// Kept outside the component so the very first render can already start in the
// right place instead of animating in from the world's origin.
function computeTransform(pathname: string) {
  const current =
    segments.find((s) => s.path === pathname) ??
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

  return {
    x: viewportW / 2 - segmentCenterX * scale,
    y: viewportH / 2 - segmentCenterY * scale,
    scale,
  }
}

export default function WorldMap() {
  const location = useLocation()
  const navigate = useNavigate()
  const unreadMessages = useUnreadMessages()
  // Lazy initialiser: the first paint is already centred on the current section,
  // so a refresh doesn't show the world's top-left corner (Browse Rentals) first.
  const [transform, setTransform] = useState(() => computeTransform(location.pathname))
  const [animated, setAnimated] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateTransform = () => setTransform(computeTransform(location.pathname))

    updateTransform()
    window.addEventListener('resize', updateTransform)
    return () => window.removeEventListener('resize', updateTransform)
  }, [location.pathname])

  // Turn the sliding animation on only after the first paint. On a refresh the
  // camera is placed correctly on frame one, and this makes sure that placement
  // is never treated as a movement (which would slide in from wherever the
  // untransformed world happened to be).
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // This element is a fixed camera viewport: the world inside it is moved with a
  // transform, never by scrolling. But an `overflow: hidden` box is still
  // programmatically scrollable, and the browser does exactly that when focus
  // lands on an off-screen button (e.g. SweetAlert2 restoring focus to the
  // "My Properties" button after it closes). That leaves a permanent scroll
  // offset the camera math knows nothing about, so every later screen appears
  // one cell off (My Properties shows the dashboard, Messages shows Wallet...).
  // Pin the scroll position to 0 so nothing can knock the camera out of place.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const pinScroll = () => {
      if (viewport.scrollLeft !== 0) viewport.scrollLeft = 0
      if (viewport.scrollTop !== 0) viewport.scrollTop = 0
    }
    pinScroll()
    viewport.addEventListener('scroll', pinScroll)
    return () => viewport.removeEventListener('scroll', pinScroll)
  }, [])

  return (
    <div ref={viewportRef} className="relative w-screen h-screen overflow-hidden bg-[var(--map-land)]">

    {location.pathname !== '/dashboard' && (
      <button
        onClick={() => navigate('/dashboard')}
        className="fixed top-6 right-6 z-20 bg-white/95 backdrop-blur rounded-2xl shadow-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:shadow-2xl transition-shadow dark:bg-slate-900/90 dark:text-slate-200 dark:border dark:border-slate-700"
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
          // Durations come from the Animations setting (MotionProvider writes
          // these variables on <html>); the fallbacks are the original values.
          transition: animated
            ? 'transform var(--motion-camera-duration, 0.9s) var(--motion-camera-easing, cubic-bezier(0.65, 0, 0.35, 1))'
            : 'none',
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
          ) : segment.id === 'messages' ? (
            <Messages />
          ) : (
            <>
              <h2 className="text-5xl font-bold text-slate-800 mb-8 dark:text-slate-100">{segment.title}</h2>

              {segment.id === 'home' ? (
                <div className="grid grid-cols-3 gap-6">
                  {segments
                    .filter((s) => s.id !== 'home')
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => navigate(s.path)}
                        className="relative bg-white rounded-xl px-8 py-6 text-xl font-semibold text-slate-700 shadow hover:shadow-lg hover:scale-105 transition-all dark:bg-slate-900 dark:text-slate-200 dark:border dark:border-slate-700"
                      >
                        {s.title}
                        {s.id === 'messages' && unreadMessages > 0 && (
                          <span className="absolute -top-2 -right-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#e05d44] px-1 text-xs font-bold text-white shadow">
                            {unreadMessages > 9 ? '9+' : unreadMessages}
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              ) : (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="bg-white rounded-xl px-6 py-3 text-lg font-medium text-slate-700 shadow hover:shadow-lg transition-all dark:bg-slate-900 dark:text-slate-200 dark:border dark:border-slate-700"
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