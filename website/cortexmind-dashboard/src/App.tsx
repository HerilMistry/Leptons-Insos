import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { SessionProvider } from "@/context/SessionContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import StartSessionPage from "@/pages/StartSessionPage";
import SessionHistoryPage from "@/pages/SessionHistoryPage";
import NotFound from "@/pages/NotFound";
import DetailedReportPage from "@/pages/DetailedReportPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SessionProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/session/start"
                element={
                  <ProtectedRoute>
                    <StartSessionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/detailed-report"
                element={
                  <ProtectedRoute>
                    <DetailedReportPage />
                  </ProtectedRoute>
                }
              />
              {/* Phase 2 routes */}
              <Route path="/session/history" element={<ProtectedRoute><SessionHistoryPage /></ProtectedRoute>} />
              <Route path="/session/:id" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SessionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
