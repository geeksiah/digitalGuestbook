import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import CoupleLayout from './layouts/CoupleLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminEvents from './pages/admin/Events'
import AdminTemplates from './pages/admin/Templates'
import CoupleDashboard from './pages/couple/Dashboard'
import PublicInvitation from './pages/public/Invitation'
import PublicRSVP from './pages/public/RSVP'
import PublicGuestbook from './pages/public/Guestbook'
import CheckIn from './pages/CheckIn'
import BoothMode from './pages/BoothMode'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default Route */}
        <Route path="/" element={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-gray-900 mb-4">Event Platform</h1>
              <p className="text-gray-600 mb-6">Select an interface to continue</p>
              <div className="space-y-3">
                <a href="/admin" className="block px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                  Admin Dashboard
                </a>
                <a href="/couple" className="block px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                  Couple Portal
                </a>
              </div>
            </div>
          </div>
        } />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="templates" element={<AdminTemplates />} />
        </Route>

        {/* Couple Portal Routes */}
        <Route path="/couple" element={<CoupleLayout />}>
          <Route index element={<CoupleDashboard />} />
        </Route>

        {/* Public Guest Routes */}
        <Route path="/e/:slug" element={<PublicInvitation />} />
        <Route path="/e/:slug/rsvp" element={<PublicRSVP />} />
        <Route path="/e/:slug/guestbook" element={<PublicGuestbook />} />
        <Route path="/e/:slug/booth" element={<BoothMode />} />

        {/* Check-In Route */}
        <Route path="/checkin/:eventSlug" element={<CheckIn />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
