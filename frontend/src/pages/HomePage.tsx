import { useNavigate } from 'react-router-dom'
import MapDashboard, { type MapBlockData } from '../components/MapDashboard'

const dashboardBlocks: MapBlockData[] = [
  { id: 'browse', title: 'Browse Rentals', arrow: '→' },
  { id: 'properties', title: 'My Properties', arrow: '→' },
  { id: 'bookings', title: 'My Bookings', arrow: '↓' },
  { id: 'messages', title: 'Messages', arrow: '↙' },
  { id: 'settings', title: 'Settings', arrow: '↓' },
  { id: 'wallet', title: 'Wallet', arrow: '↘' },
]

export default function HomePage() {
  const navigate = useNavigate()

  const handleBlockClick = (blockId: string) => {
    navigate(`/${blockId}`)
  }

  return <MapDashboard blocks={dashboardBlocks} onBlockClick={handleBlockClick} />
}