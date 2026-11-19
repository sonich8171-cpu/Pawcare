import { MotionConfig } from 'motion/react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FloatingWidgets } from './components/FloatingWidgets';
import { Footer } from './components/Footer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { HomePage } from './pages/HomePage';

const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const ServicesPage = lazy(() =>
  import('./pages/ServicesPage').then((m) => ({ default: m.ServicesPage }))
);
const CaregiversPage = lazy(() =>
  import('./pages/CaregiversPage').then((m) => ({ default: m.CaregiversPage }))
);
const ContactPage = lazy(() =>
  import('./pages/ContactPage').then((m) => ({ default: m.ContactPage }))
);
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));
const PlayZonePage = lazy(() =>
  import('./pages/PlayZonePage').then((m) => ({ default: m.PlayZonePage }))
);
const CustomerAuthPage = lazy(() =>
  import('./pages/CustomerAuthPage').then((m) => ({ default: m.CustomerAuthPage }))
);
const CaregiverAuthPage = lazy(() =>
  import('./pages/CaregiverAuthPage').then((m) => ({ default: m.CaregiverAuthPage }))
);
const AdminLoginPage = lazy(() =>
  import('./pages/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage }))
);
const CustomerDashboard = lazy(() =>
  import('./pages/CustomerDashboard').then((m) => ({ default: m.CustomerDashboard }))
);
const CaregiverDashboard = lazy(() =>
  import('./pages/CaregiverDashboard').then((m) => ({ default: m.CaregiverDashboard }))
);
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

function RouteLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="space-y-2.5 text-center">
        <div className="w-8 h-8 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-medium text-stone-500">Loading PawCare view...</p>
      </div>
    </div>
  );
}

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function LegacyAuthRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const portal = params.get('portal');
  const mode = params.get('mode');
  if (portal === 'owner' || portal === 'admin') {
    return <Navigate to="/login/admin" replace />;
  }
  if (portal === 'caregiver') {
    return <Navigate to={mode === 'register' ? '/register/caregiver' : '/login/caregiver'} replace />;
  }
  return <Navigate to={mode === 'register' ? '/register/customer' : '/login/customer'} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AuthProvider>
            <DataProvider>
              <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900">
                <Navbar />
                <div className="flex-1">
                  <ErrorBoundary>
                    <Suspense fallback={<RouteLoader />}>
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/services" element={<ServicesPage />} />
                        <Route path="/caregivers" element={<CaregiversPage />} />
                        <Route path="/play" element={<PlayZonePage defaultView="play" />} />
                        <Route path="/rewards" element={<PlayZonePage defaultView="rewards" />} />
                        <Route path="/contact" element={<ContactPage />} />
                        <Route path="/legal" element={<LegalPage />} />

                        {/* Completely Separate Role Auth Routes */}
                        <Route path="/login" element={<Navigate to="/login/customer" replace />} />
                        <Route path="/register" element={<Navigate to="/register/customer" replace />} />
                        <Route path="/login/customer" element={<CustomerAuthPage initialMode="login" />} />
                        <Route
                          path="/register/customer"
                          element={<CustomerAuthPage initialMode="register" />}
                        />
                        <Route
                          path="/login/caregiver"
                          element={<CaregiverAuthPage initialMode="login" />}
                        />
                        <Route
                          path="/register/caregiver"
                          element={<CaregiverAuthPage initialMode="register" />}
                        />
                        <Route path="/login/admin" element={<AdminLoginPage />} />
                        <Route path="/auth" element={<LegacyAuthRedirect />} />

                        {/* Strictly Role-Isolated Protected Dashboards */}
                        <Route
                          path="/customer/dashboard"
                          element={
                            <ProtectedRoute allowedRole="customer">
                              <CustomerDashboard />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/customer/dashboard/book"
                          element={
                            <ProtectedRoute allowedRole="customer">
                              <CustomerDashboard />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/caregiver/dashboard"
                          element={
                            <ProtectedRoute allowedRole="caregiver">
                              <CaregiverDashboard />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/dashboard"
                          element={
                            <ProtectedRoute allowedRole="admin">
                              <AdminDashboard />
                            </ProtectedRoute>
                          }
                        />

                        {/* Legacy Route Redirects */}
                        <Route path="/dashboard" element={<RedirectWithSearch to="/customer/dashboard" />} />
                        <Route
                          path="/dashboard/book"
                          element={<RedirectWithSearch to="/customer/dashboard/book" />}
                        />
                        <Route path="/caregiver" element={<RedirectWithSearch to="/caregiver/dashboard" />} />
                        <Route path="/owner" element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </ErrorBoundary>
                </div>
                <Footer />
                <FloatingWidgets />
                <MobileBottomNav />
              </div>
            </DataProvider>
          </AuthProvider>
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}
