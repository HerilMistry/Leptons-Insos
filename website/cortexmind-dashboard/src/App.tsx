import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { SessionProvider } from "@/context/SessionContext";
import { CognitiveStateProvider } from "@/context/CognitiveStateContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import StartSessionPage from "@/pages/StartSessionPage";
import SessionHistoryPage from "@/pages/SessionHistoryPage";
import NotFound from "@/pages/NotFound";
import DetailedReportPage from "@/pages/DetailedReportPage";
import BibliographyPage from "@/pages/BibliographyPage";
import ProfilePage from "@/pages/ProfilePage";

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
          <CognitiveStateProvider>
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
              <Route
                path="/bibliography"
                element={
                  <ProtectedRoute>
                    <BibliographyPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              {/* Phase 2 routes */}
              <Route path="/session/history" element={<ProtectedRoute><SessionHistoryPage /></ProtectedRoute>} />
              <Route path="/session/:id" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CognitiveStateProvider>
          </SessionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
