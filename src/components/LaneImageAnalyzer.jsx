import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import LaneCard from './LaneCard'
import { API_BASE_URL, API_ENDPOINTS, API_STATUS } from '../constants'

function toSafeCount(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback
}

function mergeLaneCounts(prevLane, incoming = {}) {
  return {
    ...prevLane,
    trafficScore: toSafeCount(incoming.trafficScore, prevLane.trafficScore ?? 0),
    densityLevel: typeof incoming.densityLevel === 'string' ? incoming.densityLevel : (prevLane.densityLevel ?? 'Low'),
    densityScore: Number.isFinite(Number(incoming.densityScore))
      ? Math.max(0, Math.min(1, Number(incoming.densityScore)))
      : (prevLane.densityScore ?? 0),
    topPredictions: Array.isArray(incoming.topPredictions)
      ? incoming.topPredictions
      : (prevLane.topPredictions ?? []),
  }
}

function StatusIndicator({ status }) {
  const statusConfig = {
    [API_STATUS.READY]: { colour: 'bg-emerald-500', label: 'Backend Connected' },
    [API_STATUS.ERROR]: { colour: 'bg-red-500', label: 'Backend Unavailable' },
    [API_STATUS.CHECKING]: { colour: 'bg-amber-500', label: 'Checking…' },
  }

  const { colour, label } = statusConfig[status] || statusConfig[API_STATUS.CHECKING]

  return (
    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${colour}`} />
      <span className="text-sm font-medium text-gray-800">{label}</span>
    </div>
  )
}

const LaneImageAnalyzer = forwardRef(function LaneImageAnalyzer({ lanes, onUpdate }, ref) {
  const [apiStatus, setApiStatus] = useState(API_STATUS.CHECKING)
  const analyzeRefsMap = useRef(new Map())
  useEffect(() => {
    let mounted = true

    const checkApiHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.HEALTH}`)
        if (mounted) {
          setApiStatus(response.ok ? API_STATUS.READY : API_STATUS.ERROR)
        }
      } catch {
        if (mounted) {
          setApiStatus(API_STATUS.ERROR)
        }
      }
    }

    checkApiHealth()
    return () => { mounted = false }
  }, [])

  const isApiReady = apiStatus === API_STATUS.READY

  const updateLaneDetection = useCallback((laneIndex, detectionResults) => {
    onUpdate((prevLanes) => {
      const laneScores = Array.isArray(detectionResults?.laneScores)
        ? detectionResults.laneScores
        : []

      const hasMappedLaneScores = detectionResults?.hasGlobalLaneScores === true
        && laneScores.length === prevLanes.length

      if (!hasMappedLaneScores) {
        return prevLanes.map((lane, i) => (
          i === laneIndex ? mergeLaneCounts(lane, detectionResults) : lane
        ))
      }

      return prevLanes.map((lane, i) => {
        const mappedTrafficScore = toSafeCount(laneScores[i], lane.trafficScore ?? 0)

        if (i === laneIndex) {
          return {
            ...mergeLaneCounts(lane, detectionResults),
            trafficScore: mappedTrafficScore,
          }
        }

        return {
          ...lane,
          trafficScore: mappedTrafficScore,
        }
      })
    })
  }, [onUpdate])

  const registerAnalyzeFunction = useCallback((laneIndex, analyzeFunction) => {
    analyzeRefsMap.current.set(laneIndex, analyzeFunction)
  }, [])

  const analyzeAllLanes = useCallback(async () => {
    for (let i = 0; i < lanes.length; i += 1) {
      const analyzeFn = analyzeRefsMap.current.get(i)
      if (typeof analyzeFn === 'function') {
        try {
          await analyzeFn()
        } catch (error) {
          console.error(`Failed to analyze lane ${i}:`, error)
        }
      }
    }
  }, [lanes.length])
  useImperativeHandle(ref, () => ({
    analyzeAll: analyzeAllLanes,
  }), [analyzeAllLanes])


  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <StatusIndicator status={apiStatus} />
        <button
          type="button"
          onClick={analyzeAllLanes}
          disabled={!isApiReady}
          className="rounded-full border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Analyze All Lanes
        </button>
      </div>

      {apiStatus === API_STATUS.ERROR && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          Run <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs text-red-800">python api_server.py</span> to enable detection.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {lanes.map((lane, index) => (
          <LaneCard
            key={`lane-${index}`}
            lane={lane}
            index={index}
            onDetectionComplete={updateLaneDetection}
            apiReady={isApiReady}
            onAnalyzeRef={registerAnalyzeFunction}
          />
        ))}
      </div>
    </section>
  )
})

export default LaneImageAnalyzer
