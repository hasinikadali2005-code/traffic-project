function SignalLamp({ colour, isActive, size }) {
  const colourClasses = {
    red: 'bg-red-600',
    yellow: 'bg-amber-500',
    green: 'bg-emerald-600',
  }

  const sizeClasses = {
    compact: 'h-4 w-4',
    large: 'h-8 w-8',
  }

  const glowClasses = {
    red: 'shadow-[0_0_14px_rgba(220,38,38,0.45)]',
    yellow: 'shadow-[0_0_14px_rgba(217,119,6,0.45)]',
    green: 'shadow-[0_0_14px_rgba(5,150,105,0.45)]',
  }

  const ringClasses = {
    red: 'ring-red-300/70',
    yellow: 'ring-amber-300/70',
    green: 'ring-emerald-300/70',
  }

  return (
    <span
      className={`${sizeClasses[size]} rounded-full transition-all duration-500 ${colourClasses[colour]} ${
        isActive ? `${glowClasses[colour]} ring-2 ${ringClasses[colour]} scale-110` : 'opacity-45'
      }`}
    />
  )
}

export default function TrafficLight({ signalState, orientation = 'horizontal', size = 'compact' }) {
  const wrapperClass = orientation === 'vertical'
    ? 'flex flex-col items-center gap-3 rounded-[22px] border border-gray-300 bg-white/95 px-4 py-3 shadow-sm'
    : 'mt-2 flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 shadow-sm'

  return (
    <div className={wrapperClass}>
      <SignalLamp colour="red" isActive={signalState === 'red'} size={size} />
      <SignalLamp colour="yellow" isActive={signalState === 'yellow'} size={size} />
      <SignalLamp colour="green" isActive={signalState === 'green'} size={size} />
    </div>
  )
}
