import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { AboutPage } from './pages/AboutPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AuthPage } from './pages/AuthPage';
import { CaregiverDashboard } from './pages/CaregiverDashboard';
import { CaregiversPage } from './pages/CaregiversPage';
import { ContactPage } from './pages/ContactPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { HomePage } from './pages/HomePage';
import { LegalPage } from './pages/LegalPage';
import { ServicesPage } from './pages/ServicesPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900">
            <Navbar />
            <div className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/caregivers" element={<CaregiversPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/legal" element={<LegalPage />} />
                <Route path="/auth" element={<AuthPage />} />

                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute requireCustomer>
                      <CustomerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/book"
                  element={
                    <ProtectedRoute requireCustomer>
                      <CustomerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/caregiver"
                  element={
                    <ProtectedRoute>
                      <CaregiverDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/owner"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
            <Footer />
          </div>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
