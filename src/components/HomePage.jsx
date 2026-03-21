import { useNavigate } from 'react-router-dom'
import './HomePage.css'

function HomePage() {
  const navigate = useNavigate()
  const handleStartAnalysis = () => {
    sessionStorage.setItem('traffic-dashboard-access', 'granted')
    navigate('/dashboard')
  }

  return (
    <main className="home-page">
      <section className="home-shell">
        <header className="home-topbar">
          <div className="home-nav-brand">
            <span className="home-nav-brand-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img" focusable="false">
                <path d="M10 2h4v3h-4V2Zm0 5h4v5h-4V7Zm0 7h4v8h-4v-8Z" />
              </svg>
            </span>
            <p className="home-topbar-label">STCS Dashboard</p>
          </div>

          <nav className="home-nav-links" aria-label="Dashboard sections">
            <span>Overview</span>
            <span>Signals</span>
            <span>Reports</span>
          </nav>

          <div className="home-status-chip" role="status" aria-label="System status online">
            <span className="home-status-dot" aria-hidden="true" />
            System Online
          </div>
        </header>

        <section className="home-hero">
          <p className="home-badge home-fade-item">Urban Mobility Intelligence</p>
          <h1 className="home-title home-fade-item">Smart Traffic Control System</h1>
          <div className="home-illustration-row home-fade-item" aria-label="Core platform capabilities">
            <span className="home-illustration-pill">
              <svg viewBox="0 0 24 24" role="img" focusable="false">
                <path d="M3 17h18v2H3v-2Zm2-5h14v2H5v-2Zm3-5h8v2H8V7Z" />
              </svg>
              Traffic
            </span>
            <span className="home-illustration-pill">
              <svg viewBox="0 0 24 24" role="img" focusable="false">
                <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-1v2a4 4 0 1 1-8 0v-2H7a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4Zm-1 15v1a1 1 0 1 0 2 0v-1h-2Z" />
              </svg>
              AI Engine
            </span>
            <span className="home-illustration-pill">
              <svg viewBox="0 0 24 24" role="img" focusable="false">
                <path d="M4 20V10h3v10H4Zm6 0V4h3v16h-3Zm6 0v-7h3v7h-3Z" />
              </svg>
              Analytics
            </span>
          </div>
          <p className="home-description home-fade-item">
            AI-based traffic signal optimization using lane image analysis to deliver faster, adaptive intersection decisions.
          </p>
          <button className="home-cta home-fade-item" onClick={handleStartAnalysis}>
            Start Analysis
          </button>
        </section>

        <section className="home-stats" aria-label="Platform highlights">
          <article className="home-stat-card">
            <span className="home-stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img" focusable="false">
                <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 3h7v4h-7v-4Z" />
              </svg>
            </span>
            <p className="home-stat-value">4</p>
            <p className="home-stat-label">Lane Feeds</p>
          </article>
          <article className="home-stat-card">
            <span className="home-stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img" focusable="false">
                <path d="M12 3a1 1 0 0 1 1 1v1.08a7 7 0 0 1 5.92 5.92H20a1 1 0 1 1 0 2h-1.08A7 7 0 0 1 13 18.92V20a1 1 0 1 1-2 0v-1.08A7 7 0 0 1 5.08 13H4a1 1 0 1 1 0-2h1.08A7 7 0 0 1 11 5.08V4a1 1 0 0 1 1-1Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
              </svg>
            </span>
            <p className="home-stat-value">Adaptive</p>
            <p className="home-stat-label">Signal Logic</p>
          </article>
          <article className="home-stat-card">
            <span className="home-stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img" focusable="false">
                <path d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm1 5a1 1 0 0 0-2 0v5.41l3.3 3.3a1 1 0 0 0 1.4-1.42L13 11.59Z" />
              </svg>
            </span>
            <p className="home-stat-value">Real-Time</p>
            <p className="home-stat-label">Decision Loop</p>
          </article>
        </section>
      </section>
    </main>
  )
}

export default HomePage
