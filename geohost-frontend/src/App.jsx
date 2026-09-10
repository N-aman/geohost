// Version 2.0.0 - Geohost Full Overhaul
export const APP_VERSION = '2.0.0'
import React, { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'

// Code splitting via React.lazy
const Home = lazy(() => import('./pages/Home.jsx'))
const Explore = lazy(() => import('./pages/Explore.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Analytics = lazy(() => import('./pages/Analytics.jsx'))
const Status = lazy(() => import('./pages/Status.jsx'))
const Upload = lazy(() => import('./pages/Upload.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
const AdminLogin = lazy(() => import('./pages/AdminLogin.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Privacy = lazy(() => import('./pages/Privacy.jsx'))
const Terms = lazy(() => import('./pages/Terms.jsx'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function RequireAuth({ children }) {
  const [state, setState] = useState('checking')
  useEffect(() => {
    fetch('/me', { credentials: 'include' })
      .then(res => setState(res.ok ? 'authed' : 'anon'))
      .catch(() => setState('anon'))
  }, [])
  if (state === 'checking') {
    return (
      <div style={{ maxWidth: '400px', margin: '120px auto', textAlign: 'center' }}>
        <div className="skeleton" style={{ height: '32px', width: '60%', margin: '0 auto 16px auto' }} />
        <div className="skeleton" style={{ height: '100px' }} />
      </div>
    )
  }
  if (state === 'anon') return <Navigate to="/login" replace />
  return children
}

function LoadingFallback() {
  return (
    <div style={{ maxWidth: '900px', margin: '80px auto', padding: '0 24px' }}>
      <div className="skeleton" style={{ height: '36px', width: '300px', marginBottom: '24px' }} />
      <div className="skeleton" style={{ height: '300px', width: '100%', borderRadius: '12px' }} />
    </div>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
          <Route path="/status" element={<Status />} />
          <Route path="/upload" element={<RequireAuth><Upload /></RequireAuth>} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
