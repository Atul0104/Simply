import { lazy, Suspense } from 'react';
import '@/App.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Seo from '@/components/Seo';
import BottleLoader from '@/components/BottleLoader';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ConsentProvider } from '@/contexts/ConsentContext';
import CookieConsent from '@/components/CookieConsent';

const CustomerPortal = lazy(() => import('@/pages/CustomerPortal'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const PolicyPage = lazy(() => import('@/pages/PolicyPage'));

function PrivateRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <><Seo title="Account portal" noindex />{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <div id="main-content" tabIndex="-1" className="outline-none">
      <Suspense fallback={<BottleLoader label="Preparing Perfurm" />}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/cookie-policy" element={<PolicyPage />} />
          <Route path="/privacy-policy" element={<PolicyPage />} />
          <Route path="/" element={
            user ? (
              user.role === 'admin' ? <Navigate to="/admin" replace /> :
              <CustomerPortal />
            ) : <CustomerPortal />
          } />
          <Route path="/customer/*" element={<CustomerPortal />} />
          <Route path="/admin/*" element={<PrivateRoute allowedRoles={['admin']}><AdminDashboard /></PrivateRoute>} />
          <Route path="/seller/*" element={<Navigate to="/" replace />} />
          <Route path="/delivery/*" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <div className="App">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <AppErrorBoundary>
        <BrowserRouter><ConsentProvider><AuthProvider><AppRoutes /><CookieConsent /></AuthProvider></ConsentProvider></BrowserRouter>
      </AppErrorBoundary>
    </div>
  );
}
