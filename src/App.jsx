import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { trackPageView, captureAttribution } from './lib/metaPixel.js'
import Home from './pages/Home.jsx'
import VerticalLanding from './pages/VerticalLanding.jsx'
import Signup from './pages/Signup.jsx'
import Success from './pages/Success.jsx'
import Cancel from './pages/Cancel.jsx'
import NotFound from './pages/NotFound.jsx'
import { VERTICALS } from './config/verticals/index.js'

export default function App() {
  const location = useLocation()

  // Meta PageView on first load and on every SPA route change.
  useEffect(() => {
    captureAttribution(location.search)
    trackPageView(location.pathname + location.search)
  }, [location.pathname, location.search])

  return (
    <Routes>
      {/* Platform homepage - industry picker renders from the registry */}
      <Route path="/" element={<Home />} />

      {/* One route per registered vertical — new verticals appear here
          automatically when added to the registry. */}
      {VERTICALS.map((v) => (
        <Route key={v.slug} path={`/${v.slug}`} element={<VerticalLanding config={v} />} />
      ))}

      <Route path="/signup" element={<Signup />} />
      <Route path="/signup/:vertical" element={<Signup />} />
      <Route path="/onboarding/success" element={<Success />} />
      <Route path="/onboarding/cancel" element={<Cancel />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
