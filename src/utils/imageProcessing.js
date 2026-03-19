import { IMAGE_CONFIG, DENSITY_TO_SCORE } from '../constants'

function toNonNegativeInteger(value, fallback = null) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(0, Math.round(numeric))
}

/**
 * Convert an HTML image element to base64 JPEG string
 * @param {HTMLImageElement} imageElement - Image element to convert
 * @returns {string} Base64 JPEG string without data URL prefix
 */
export function imageToBase64(imageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = imageElement.naturalWidth
  canvas.height = imageElement.naturalHeight
  canvas.getContext('2d').drawImage(imageElement, 0, 0)
  return canvas.toDataURL('image/jpeg', IMAGE_CONFIG.JPEG_QUALITY).split(',')[1]
}

/**
 * Create a FormData object with an image file for multipart upload
 * @param {File} file - Image file to upload
 * @returns {FormData} FormData object ready for upload
 */
export function createImageFormData(file) {
  const formData = new FormData()
  formData.append('image', file)
  return formData
}

/**
 * Extract lane density classification values from API response.
 * @param {Object} response - API response object
 * @param {number} laneIndex - Current lane index where detection was triggered
 * @param {number} totalLanes - Total lanes in the UI (A, B, C, D => 4)
 * @returns {Object} Normalized lane density object
 */
export function extractLaneDensity(response, laneIndex = 0, totalLanes = 4) {
  const densityLevel = typeof response?.traffic_density === 'string'
    ? response.traffic_density
    : 'Low'

  const densityScore = (() => {
    const parsed = Number(response?.density_score)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.min(1, parsed))
  })()

  const trafficScore = toNonNegativeInteger(response?.traffic_score, null)
    ?? DENSITY_TO_SCORE[densityLevel]
    ?? 0

  const laneScores = Array.isArray(response?.lane_scores) ? response.lane_scores : []
  const hasGlobalLaneScores = laneScores.length === totalLanes
  const laneScoreMap = hasGlobalLaneScores
    ? laneScores.map((value) => toNonNegativeInteger(value, 0))
    : null

  const laneLocalCount = laneScores.length === 1 && Number.isFinite(Number(laneScores[0]))
    ? toNonNegativeInteger(laneScores[0], trafficScore)
    : trafficScore

  return {
    trafficScore: laneLocalCount,
    densityLevel,
    densityScore,
    topPredictions: Array.isArray(response?.top_predictions) ? response.top_predictions : [],
    laneScores: laneScoreMap,
    hasGlobalLaneScores,
  }
}
