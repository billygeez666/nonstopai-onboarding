import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Signup from './pages/Signup.jsx'
import Success from './pages/Success.jsx'
import Cancel from './pages/Cancel.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding/success" element={<Success />} />
      <Route path="/onboarding/cancel" element={<Cancel />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
