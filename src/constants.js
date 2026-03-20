// API Configuration
export const API_BASE_URL = 'https://traffic-project-clfg.onrender.com'

export const API_ENDPOINTS = {
  HEALTH: '/health',
  DETECT: '/detect',
  DETECT_FILE: '/detect-file',
  BATCH_DETECT: '/batch-detect',
  CONFIG: '/config',
}

// Lane Configuration
export const LANE_NAMES = ['A', 'B', 'C', 'D']

// Detection Configuration
export const DENSITY_LEVELS = ['Low', 'Medium', 'High']

export const DENSITY_TO_SCORE = {
  Low: 20,
  Medium: 55,
  High: 90,
}

export const DENSITY_TO_DOTS = {
  Low: 4,
  Medium: 9,
  High: 14,
}

// Image Upload Configuration
export const IMAGE_CONFIG = {
  ACCEPT: 'image/*',
  JPEG_QUALITY: 0.92,
  PREVIEW_HEIGHT: 224,
}

// API Status States
export const API_STATUS = {
  CHECKING: 'checking',
  READY: 'ready',
  ERROR: 'error',
}