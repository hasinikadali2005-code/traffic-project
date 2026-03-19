import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL, API_ENDPOINTS, IMAGE_CONFIG } from '../constants'
import { imageToBase64, extractLaneDensity } from '../utils/imageProcessing'

const DENSITY_BADGE_STYLES = {
  Low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700',
  High: 'border-rose-200 bg-rose-50 text-rose-700',
}

function normalizeDensityLabel(label) {
  if (label === 'Low' || label === 'Medium' || label === 'High') {
    return label
  }
  return 'Low'
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function LaneCard({
  lane,
  index,
  onDetectionComplete,
  apiReady,
  onAnalyzeRef,
}) {
  const [imageUrl, setImageUrl] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const imageRef = useRef(null)
  const densityLabel = normalizeDensityLabel(lane?.densityLevel)
  const densityBadgeClass = DENSITY_BADGE_STYLES[densityLabel] ?? DENSITY_BADGE_STYLES.Low

  const handleFileSelect = useCallback((file) => {
    if (!file) return

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setImageUrl(objectUrl)
    setErrorMessage('')
  }, [imageUrl])

  const performDetection = useCallback(async () => {
    if (!imageRef.current || !apiReady || !imageUrl) return

    setIsAnalyzing(true)
    setErrorMessage('')

    try {
      const base64Image = imageToBase64(imageRef.current)
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.DETECT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Classification failed')
      }

      onDetectionComplete(index, extractLaneDensity(data, index, 4))
    } catch (error) {
      setErrorMessage(error.message)
      console.error(`Lane ${index} detection error:`, error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [apiReady, imageUrl, index, onDetectionComplete])

  useEffect(() => {
    onAnalyzeRef(index, performDetection)
  }, [index, performDetection, onAnalyzeRef])

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-2xl font-semibold text-gray-900">Lane {lane.name}</h3>

          <div className="mt-3 flex items-center gap-3">
            <input
              type="file"
              accept={IMAGE_CONFIG.ACCEPT}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-gray-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-gray-800 hover:file:bg-gray-50 cursor-pointer"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-600">Traffic Density</p>
            <div className="mt-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${densityBadgeClass}`}>
                {densityLabel}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Score: {lane.trafficScore ?? 0} · Confidence: {Math.round((lane.densityScore ?? 0) * 100)}%
            </p>
          </div>

          {errorMessage && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={performDetection}
          disabled={!imageUrl || isAnalyzing || !apiReady}
          className="hidden rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 md:block"
        >
          {isAnalyzing ? (
            <span className="inline-flex items-center gap-2"><Spinner />Analyzing</span>
          ) : 'Analyze'}
        </button>
      </div>

      {imageUrl && (
        <img
          ref={imageRef}
          src={imageUrl}
          alt={`Lane ${lane.name}`}
          className="hidden"
        />
      )}
    </article>
  )
}
