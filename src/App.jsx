import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LaneImageAnalyzer from './components/LaneImageAnalyzer'
import IntersectionView from './components/IntersectionView'
import { LANE_NAMES } from './constants'
import './App.css'

const API_URL = "https://traffic-project-clfg.onrender.com"

const SIGNAL_PHASES = {
  GREEN: 'green',
  YELLOW: 'yellow',
}

const GREEN_DURATION = {
  High: 40,
  Medium: 30,
  Low: 25,
}

const YELLOW_DURATION_SECONDS = 3

// ---------------- API CALL ----------------
async function analyzeImage(file) {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(`${API_URL}/detect-file`, {
    method: "POST",
    body: formData,
  })

  return await res.json()
}

// ---------------- HELPERS ----------------
function normalizeDensity(value) {
  if (!value) return "Low"
  const v = value.toLowerCase()
  if (v === "high") return "High"
  if (v === "medium") return "Medium"
  return "Low"
}

function getDuration(density) {
  return GREEN_DURATION[density] || 25
}

function sortLanesByPriority(lanes) {
  const priority = { High: 3, Medium: 2, Low: 1 }

  return lanes
    .map((lane, index) => ({
      ...lane,
      index,
      densityLevel: normalizeDensity(lane.densityLevel)
    }))
    .sort((a, b) => priority[b.densityLevel] - priority[a.densityLevel])
}

// ---------------- MAIN APP ----------------
function App() {
  const [lanes, setLanes] = useState(() => LANE_NAMES.map(name => ({
    name,
    densityLevel: "Low",
    trafficScore: 0
  })))

  const [activeLaneIndex, setActiveLaneIndex] = useState(0)
  const [activePhase, setActivePhase] = useState(SIGNAL_PHASES.GREEN)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [isSignalRunning, setIsSignalRunning] = useState(false)

  const [priorityQueue, setPriorityQueue] = useState([])

  const analyzerRef = useRef(null)

  // ---------------- START ----------------
  const handleStartSignalTiming = useCallback(async () => {
    const updated = []

    for (let i = 0; i < lanes.length; i++) {
      const file = analyzerRef.current?.getLaneImage?.(i)

      if (file) {
        const res = await analyzeImage(file)

        updated.push({
          ...lanes[i],
          densityLevel: normalizeDensity(res.traffic_density)
        })
      } else {
        updated.push(lanes[i])
      }
    }

    setLanes(updated)

    // 🔥 SORT BY PRIORITY
    const sorted = sortLanesByPriority(updated)
    setPriorityQueue(sorted)

    // FIRST = highest priority
    const first = sorted[0]

    setActiveLaneIndex(first.index)
    setActivePhase(SIGNAL_PHASES.GREEN)
    setSecondsRemaining(getDuration(first.densityLevel))
    setIsSignalRunning(true)

  }, [lanes])

  // ---------------- TIMER ----------------
  useEffect(() => {
    if (!isSignalRunning) return

    const timer = setInterval(() => {
      setSecondsRemaining(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [isSignalRunning])

  // ---------------- PHASE SWITCH ----------------
  useEffect(() => {
    if (!isSignalRunning || secondsRemaining > 0) return

    if (activePhase === SIGNAL_PHASES.GREEN) {
      setActivePhase(SIGNAL_PHASES.YELLOW)
      setSecondsRemaining(YELLOW_DURATION_SECONDS)
    } else {
      // 🔥 MOVE TO NEXT IN PRIORITY QUEUE
      setPriorityQueue(prev => {
        const newQueue = [...prev]
        const finished = newQueue.shift()
        newQueue.push(finished)

        const next = newQueue[0]

        setActiveLaneIndex(next.index)
        setActivePhase(SIGNAL_PHASES.GREEN)
        setSecondsRemaining(getDuration(next.densityLevel))

        return newQueue
      })
    }
  }, [secondsRemaining, isSignalRunning, activePhase])

  // ---------------- UI ----------------
  const lanesWithSignals = useMemo(() => (
    lanes.map((lane, i) => ({
      ...lane,
      signalState:
        i === activeLaneIndex
          ? (activePhase === 'yellow' ? 'yellow' : 'green')
          : 'red',
    }))
  ), [lanes, activeLaneIndex, activePhase])

  return (
    <main style={{ textAlign: "center", padding: "20px" }}>
      <h1>🚦 Smart Traffic Control System</h1>

      <LaneImageAnalyzer ref={analyzerRef} lanes={lanesWithSignals} onUpdate={setLanes} />

      <button onClick={handleStartSignalTiming} style={{ padding: "10px 20px", marginTop: "20px" }}>
        Start Signal Timing
      </button>

      {isSignalRunning && (
        <div style={{ marginTop: "20px" }}>
          <h2>
            ⏱ {secondsRemaining}s — {activePhase.toUpperCase()}
          </h2>
          <p>
            Active Lane: {lanes[activeLaneIndex]?.name}
          </p>
        </div>
      )}

      {/* DEBUG */}
      <div style={{ marginTop: "20px" }}>
        {lanes.map((lane, i) => (
          <p key={i}>
            Lane {lane.name}: {lane.densityLevel}
          </p>
        ))}
      </div>

      <IntersectionView lanes={lanesWithSignals} activeLaneIndex={activeLaneIndex} />
    </main>
  )
}

export default App