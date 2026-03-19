import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LaneImageAnalyzer from './components/LaneImageAnalyzer'
import IntersectionView from './components/IntersectionView'
import { LANE_NAMES } from './constants'
import './App.css'

const SIGNAL_STATES = {
  RED: 'red',
  YELLOW: 'yellow',
  GREEN: 'green',
}

const SIGNAL_PHASES = {
  GREEN: 'green',
  YELLOW: 'yellow',
}

const DENSITY_PRIORITY = {
  Low: 1,
  Medium: 2,
  High: 3,
}

const GREEN_DURATION_BY_DENSITY = {
  Low: 12,
  Medium: 24,
  High: 40,
}

const YELLOW_DURATION_SECONDS = 3

function getLaneTrafficScore(lane) {
  if (Number.isFinite(Number(lane?.trafficScore))) {
    return Math.max(0, Math.round(Number(lane.trafficScore)))
  }
  return 0
}

function getLaneDensityLevel(lane) {
  const density = lane?.densityLevel
  return density === 'Low' || density === 'Medium' || density === 'High' ? density : 'Low'
}

function getLaneDensityPriority(lane) {
  return DENSITY_PRIORITY[getLaneDensityLevel(lane)] ?? DENSITY_PRIORITY.Low
}

function calculateGreenDuration(lanes, laneIndex) {
  const density = getLaneDensityLevel(lanes[laneIndex])
  return GREEN_DURATION_BY_DENSITY[density] ?? GREEN_DURATION_BY_DENSITY.Low
}

function getHighestVehicleLaneIndex(lanes, fallbackIndex = 0) {
  if (!lanes.length) {
    return 0
  }

  let highestIndex = fallbackIndex
  let highestPriority = getLaneDensityPriority(lanes[fallbackIndex])
  let highestScore = getLaneTrafficScore(lanes[fallbackIndex])

  lanes.forEach((lane, index) => {
    const lanePriority = getLaneDensityPriority(lane)
    const laneScore = getLaneTrafficScore(lane)
    if (lanePriority > highestPriority) {
      highestPriority = lanePriority
      highestScore = laneScore
      highestIndex = index
      return
    }

    if (lanePriority === highestPriority && laneScore > highestScore) {
      highestScore = laneScore
      highestIndex = index
    }
  })

  return highestIndex
}

function getNextPriorityLaneIndex(lanes, currentLaneIndex) {
  if (!lanes.length) {
    return 0
  }

  const candidateIndices = lanes.map((_, index) => index).filter((index) => index !== currentLaneIndex)
  if (!candidateIndices.length) {
    return currentLaneIndex
  }

  let bestIndex = candidateIndices[0]
  let bestPriority = getLaneDensityPriority(lanes[bestIndex])
  let bestScore = getLaneTrafficScore(lanes[bestIndex])

  candidateIndices.forEach((index) => {
    const lanePriority = getLaneDensityPriority(lanes[index])
    const laneScore = getLaneTrafficScore(lanes[index])

    if (lanePriority > bestPriority) {
      bestPriority = lanePriority
      bestScore = laneScore
      bestIndex = index
      return
    }

    if (lanePriority === bestPriority && laneScore > bestScore) {
      bestScore = laneScore
      bestIndex = index
      return
    }

    if (lanePriority === bestPriority && laneScore === bestScore) {
      const bestDistance = (bestIndex - currentLaneIndex + lanes.length) % lanes.length
      const currentDistance = (index - currentLaneIndex + lanes.length) % lanes.length
      if (currentDistance < bestDistance) {
        bestIndex = index
      }
    }
  })

  return bestIndex
}

function createEmptyLane(name) {
  return {
    name,
    trafficScore: 0,
    densityLevel: 'Low',
    densityScore: 0,
    topPredictions: [],
  }
}

function App() {
  const [lanes, setLanes] = useState(() => LANE_NAMES.map(createEmptyLane))
  const [activeLaneIndex, setActiveLaneIndex] = useState(0)
  const [activePhase, setActivePhase] = useState(SIGNAL_PHASES.GREEN)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [isSignalRunning, setIsSignalRunning] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [pendingStart, setPendingStart] = useState(false)

  const analyzerRef = useRef(null)

  // Keep a ref to latest lanes so async handlers can read fresh data
  const latestLanesRef = useRef(lanes)
  useEffect(() => { latestLanesRef.current = lanes }, [lanes])

  // Kick off signal timing after analysis + state flush (pendingStart guarantees lanes are current)
  useEffect(() => {
    if (!pendingStart) return
    setPendingStart(false)
    const currentLanes = latestLanesRef.current
    const highestIdx = getHighestVehicleLaneIndex(currentLanes, 0)
    const duration = calculateGreenDuration(currentLanes, highestIdx)
    setActiveLaneIndex(highestIdx)
    setActivePhase(SIGNAL_PHASES.GREEN)
    setSecondsRemaining(duration)
    setIsSignalRunning(true)
  }, [pendingStart])

  // 1s tick — only runs when signal is active
  useEffect(() => {
    if (!isSignalRunning) return
    const timer = window.setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isSignalRunning])

  // Phase transition — fires when timer reaches 0
  useEffect(() => {
    if (!isSignalRunning || secondsRemaining > 0) return

    if (activePhase === SIGNAL_PHASES.GREEN) {
      setActivePhase(SIGNAL_PHASES.YELLOW)
      setSecondsRemaining(YELLOW_DURATION_SECONDS)
      return
    }

    // Yellow ended → switch to highest-density lane (excluding current)
    const nextIndex = getNextPriorityLaneIndex(lanes, activeLaneIndex)
    const nextDuration = calculateGreenDuration(lanes, nextIndex)
    setActiveLaneIndex(nextIndex)
    setActivePhase(SIGNAL_PHASES.GREEN)
    setSecondsRemaining(nextDuration)
  }, [secondsRemaining, isSignalRunning, activePhase, activeLaneIndex, lanes])

  const handleStartSignalTiming = useCallback(async () => {
    setIsAnalyzing(true)
    if (analyzerRef.current?.analyzeAll) {
      await analyzerRef.current.analyzeAll()
    }
    setIsAnalyzing(false)
    // pendingStart useEffect will initialize the signal once lanes state is flushed
    setPendingStart(true)
  }, [])

  const lanesWithSignals = useMemo(() => (
    lanes.map((lane, index) => {
      if (index !== activeLaneIndex) {
        return { ...lane, signalState: SIGNAL_STATES.RED, isSignalActive: false }
      }

      return {
        ...lane,
        signalState: activePhase === SIGNAL_PHASES.YELLOW ? SIGNAL_STATES.YELLOW : SIGNAL_STATES.GREEN,
        isSignalActive: true,
      }
    })
  ), [lanes, activeLaneIndex, activePhase])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-gray-800 md:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">Smart Traffic Control System</h1>
        </header>

        <LaneImageAnalyzer ref={analyzerRef} lanes={lanesWithSignals} onUpdate={setLanes} />

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-5 shadow-sm">
          {!isSignalRunning ? (
            <button
              type="button"
              onClick={handleStartSignalTiming}
              disabled={isAnalyzing}
              className="relative overflow-hidden rounded-full bg-emerald-600 px-10 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Analyzing Lanes…
                </span>
              ) : (
                '▶  Start Signal Timing'
              )}
            </button>
          ) : (
            <>
              <div className="text-center">
                <span
                  className={`text-6xl font-bold ${
                    activePhase === SIGNAL_PHASES.YELLOW ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {secondsRemaining}s
                </span>
                <p className="mt-1 text-xs font-medium uppercase tracking-widest text-gray-500">
                  {activePhase === SIGNAL_PHASES.YELLOW ? 'Clearing' : `Lane ${lanes[activeLaneIndex]?.name} — Green`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartSignalTiming}
                disabled={isAnalyzing}
                className="rounded-full border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAnalyzing ? 'Analyzing…' : '↺  Re-analyze & Restart'}
              </button>
            </>
          )}

          {isSignalRunning && (
            <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600">
              {lanes.map((lane, i) => {
                const vc = getLaneTrafficScore(lane)
                const dur = calculateGreenDuration(lanes, i)
                return (
                  <span key={i} className={i === activeLaneIndex ? 'font-semibold text-emerald-700' : ''}>
                    Lane {lane.name}: {lane.densityLevel ?? 'Low'} ({vc}) → {dur}s
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <IntersectionView lanes={lanesWithSignals} activeLaneIndex={activeLaneIndex} />
      </div>
    </main>
  )
}

export default App
