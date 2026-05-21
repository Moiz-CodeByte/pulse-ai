import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Preloader } from "@/components/ui/Preloader";

// Pages
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Doctors from "./pages/Doctors";

// Patient Pages
import PatientDashboard from "./pages/patient/Dashboard";
import PatientUpload from "./pages/patient/Upload";
import PatientReports from "./pages/patient/Reports";
import PatientPrescriptions from "./pages/patient/Prescriptions";
import PatientChat from "./pages/patient/Chat";

// Doctor Pages
import DoctorDashboard from "./pages/doctor/Dashboard";
import DoctorCases from "./pages/doctor/Cases";
import DoctorPrescriptions from "./pages/doctor/Prescriptions";
import DoctorCompleteProfile from "./pages/doctor/CompleteProfile";
import DoctorConsultationRequests from "./pages/doctor/ConsultationRequests";
import DoctorChat from "./pages/doctor/Chat";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminVerifyDoctors from "./pages/admin/VerifyDoctors";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Preloader />
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/doctors" element={<Doctors />} />

            {/* Patient Routes */}
            <Route
              path="/patient"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <PatientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/upload"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <PatientUpload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/reports"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <PatientReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/prescriptions"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <PatientPrescriptions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/chat"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <PatientChat />
                </ProtectedRoute>
              }
            />

            {/* Doctor Routes */}
            <Route
              path="/doctor/complete-profile"
              element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <DoctorCompleteProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor"
              element={
                <ProtectedRoute allowedRoles={['doctor']} requireVerified>
                  <DoctorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/cases"
              element={
                <ProtectedRoute allowedRoles={['doctor']} requireVerified>
                  <DoctorCases />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/prescriptions"
              element={
                <ProtectedRoute allowedRoles={['doctor']} requireVerified>
                  <DoctorPrescriptions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/consultations"
              element={
                <ProtectedRoute allowedRoles={['doctor']} requireVerified>
                  <DoctorConsultationRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/chat"
              element={
                <ProtectedRoute allowedRoles={['doctor']} requireVerified>
                  <DoctorChat />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/verify-doctors"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminVerifyDoctors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
