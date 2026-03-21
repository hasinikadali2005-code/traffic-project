import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './components/HomePage'
import AnalysisPage from './components/AnalysisPage'

function ProtectedDashboard() {
  const hasAccess = sessionStorage.getItem('traffic-dashboard-access') === 'granted'

  if (!hasAccess) {
    return <Navigate to="/" replace />
  }

  return <AnalysisPage />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<ProtectedDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App