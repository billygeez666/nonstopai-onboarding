import { Routes, Route } from 'react-router-dom'
import VerticalLanding from './pages/VerticalLanding.jsx'
import Signup from './pages/Signup.jsx'
import Success from './pages/Success.jsx'
import Cancel from './pages/Cancel.jsx'
import NotFound from './pages/NotFound.jsx'
import { VERTICALS, getVertical } from './config/verticals/index.js'

export default function App() {
  const taxi = getVertical('taxi')

  return (
    <Routes>
      {/* Phase 1: homepage still renders the taxi config (identical UX).
          Phase 3 replaces this with the platform homepage. */}
      <Route path="/" element={<VerticalLanding config={taxi} />} />

      {/* One route per registered vertical — new verticals appear here
          automatically when added to the registry. */}
      {VERTICALS.map((v) => (
        <Route key={v.slug} path={`/${v.slug}`} element={<VerticalLanding config={v} />} />
      ))}

      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding/success" element={<Success />} />
      <Route path="/onboarding/cancel" element={<Cancel />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
