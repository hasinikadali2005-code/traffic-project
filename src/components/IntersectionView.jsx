import TrafficLight from './TrafficLight'
import { DENSITY_TO_DOTS } from '../constants'

function VehicleStream({ lane, position, isActive }) {
  const densityLevel = lane?.densityLevel ?? 'Low'
  const count = Math.min(DENSITY_TO_DOTS[densityLevel] ?? 4, 16)
  const dots = Array.from({ length: count }).map((_, index) => ({
    id: `${lane.name}-${index}`,
    offset: index * 12,
    delay: `${index * 0.12}s`,
  }))

  const laneLabelClass = 'absolute text-sm font-medium text-gray-600'
  const containerPosition = {
    top: 'top-[28%] left-[14%] w-[18%]',
    right: 'top-[28%] right-[14%] w-[18%]',
    bottom: 'bottom-[11%] right-[23%] w-[18%]',
    left: 'bottom-[11%] left-[14%] w-[18%]',
  }

  const labelPosition = {
    top: 'top-[57%] left-[48%]',
    right: 'top-[57%] right-[2%]',
    bottom: 'bottom-[2%] right-[21%]',
    left: 'bottom-[2%] left-[2%]',
  }

  return (
    <>
      <div className={`${containerPosition[position]} absolute overflow-hidden`}>
        <div className="relative h-6">
          {dots.map((dot) => (
            <span
              key={dot.id}
              className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-sky-500 ${
                isActive ? 'intersection-dot-active shadow-[0_0_8px_rgba(14,165,233,0.35)]' : 'intersection-dot-idle opacity-70'
              }`}
              style={{
                left: `${dot.offset}px`,
                animationDelay: dot.delay,
              }}
            />
          ))}
        </div>
      </div>
      <span className={`${laneLabelClass} ${labelPosition[position]}`}>Lane {lane.name}</span>
    </>
  )
}

export default function IntersectionView({ lanes, activeLaneIndex }) {
  const topLane = lanes[0]
  const rightLane = lanes[1]
  const bottomLane = lanes[2]
  const leftLane = lanes[3]

  return (
    <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.12),_transparent_60%)]" />

      <div className="relative h-[540px] w-full">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 border-l-2 border-dashed border-gray-300" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 border-t-2 border-dashed border-gray-300" />

        <div className="absolute left-1/2 top-1/2 h-[250px] w-[360px] -translate-x-1/2 -translate-y-1/2 bg-slate-100" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[120px] -translate-x-1/2 -translate-y-1/2 bg-slate-200" />
        <div className="absolute left-1/2 top-1/2 h-[120px] w-[420px] -translate-x-1/2 -translate-y-1/2 bg-slate-200" />

        <div className="absolute left-1/2 top-[18px] -translate-x-1/2">
          <TrafficLight signalState={topLane.signalState} orientation="vertical" size="large" />
        </div>
        <div className="absolute left-[32%] top-1/2 -translate-y-1/2">
          <TrafficLight signalState={leftLane.signalState} orientation="vertical" size="large" />
        </div>
        <div className="absolute right-[32%] top-1/2 -translate-y-1/2">
          <TrafficLight signalState={rightLane.signalState} orientation="vertical" size="large" />
        </div>
        <div className="absolute bottom-[18px] left-1/2 -translate-x-1/2">
          <TrafficLight signalState={bottomLane.signalState} orientation="vertical" size="large" />
        </div>

        <div className={`absolute left-1/2 top-[31%] h-[96px] w-[2px] -translate-x-1/2 transition-all duration-500 ${
          activeLaneIndex === 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]' : 'bg-transparent'
        }`} />
        <div className={`absolute left-[32%] top-1/2 h-[2px] w-[18%] -translate-y-1/2 transition-all duration-500 ${
          activeLaneIndex === 3 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]' : 'bg-transparent'
        }`} />
        <div className={`absolute right-[32%] top-1/2 h-[2px] w-[18%] -translate-y-1/2 transition-all duration-500 ${
          activeLaneIndex === 1 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]' : 'bg-transparent'
        }`} />
        <div className={`absolute bottom-[31%] left-1/2 h-[96px] w-[2px] -translate-x-1/2 transition-all duration-500 ${
          activeLaneIndex === 2 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]' : 'bg-transparent'
        }`} />

        <div className={`absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent transition-all duration-500 ${
          activeLaneIndex === 0 ? 'border-b-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.35)]' : 'border-b-gray-400'
        }`} />

        <VehicleStream lane={topLane} position="top" isActive={activeLaneIndex === 0} />
        <VehicleStream lane={rightLane} position="right" isActive={activeLaneIndex === 1} />
        <VehicleStream lane={bottomLane} position="bottom" isActive={activeLaneIndex === 2} />
        <VehicleStream lane={leftLane} position="left" isActive={activeLaneIndex === 3} />
      </div>
    </section>
  )
}
