export interface MapBlockData {
  id: string
  title: string
  arrow: string // e.g. '→', '↓', '↙', '↘', '←', '↑'
}

interface MapDashboardProps {
  blocks: MapBlockData[]
  onBlockClick: (blockId: string) => void
}

export default function MapDashboard({ blocks, onBlockClick }: MapDashboardProps) {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#eeeae0]">
      {/* Decorative metro lines — purely visual, not clickable */}
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <polyline points="0,600 150,450 300,450" fill="none" stroke="#e05d44" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="0,300 200,300 380,80" fill="none" stroke="#4a9e4a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="700,0 700,180 900,380 900,600" fill="none" stroke="#e8b830" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="1000,60 850,60 780,130 780,600" fill="none" stroke="#3fa7c4" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* The actual menu */}
      <div className="relative z-10 pt-16 pl-16">
        <h1 className="text-6xl font-extrabold text-gray-800 mb-8">Dashboard</h1>
        <div className="flex flex-col gap-3 max-w-md">
          {blocks.map((block) => (
            <button
              key={block.id}
              onClick={() => onBlockClick(block.id)}
              className="flex items-center gap-4 text-left group"
            >
              <span className="text-3xl font-bold text-gray-800 w-8">{block.arrow}</span>
              <span className="bg-blue-500 group-hover:bg-blue-600 text-white text-2xl font-bold px-4 py-1 transition-colors duration-150">
                {block.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}