import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { AppLayout } from "./layouts/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { OnboardPage } from "./pages/OnboardPage";
import { InstallPage } from "./pages/InstallPage";
import { PricingPage } from "./pages/PricingPage";
import { LandingPage } from "./pages/LandingPage";
import { PilotPage } from "./pages/PilotPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SuperAdminPage } from "./pages/SuperAdminPage";
import { AthletesPage } from "./pages/AthletesPage";
import { RegistrationsPage } from "./pages/RegistrationsPage";
import { AgendaPage } from "./pages/AgendaPage";
import { TeamsPage } from "./pages/TeamsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { FeedbackAdminPage } from "./pages/FeedbackAdminPage";
import { FinancePage } from "./pages/FinancePage";
import { InventoryPage } from "./pages/InventoryPage";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { DownloadPage } from "./pages/DownloadPage";
import { GuidePage } from "./pages/GuidePage";
import { UsersPage } from "./pages/UsersPage";
import { RoleRoute } from "./components/RoleRoute";

/** `/` invité → landing ; autres routes app → login ; connecté → shell. */
function RootShell() {
  const { token } = useAuth();
  const loc = useLocation();
  if (!token) {
    if (loc.pathname === "/" || loc.pathname === "") return <LandingPage />;
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return <AppLayout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboard" element={<OnboardPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/offre" element={<PricingPage />} />
      <Route path="/pilote" element={<PilotPage />} />
      <Route path="/pilot" element={<PilotPage />} />
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/install" element={<InstallPage />} />
      <Route path="/app" element={<InstallPage />} />
      <Route path="/download" element={<DownloadPage />} />
      <Route path="/guide" element={<GuidePage />} />
      <Route path="/" element={<RootShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="platform" element={<RoleRoute allow={["superadmin"]}><SuperAdminPage /></RoleRoute>} />
        <Route path="athletes" element={<RoleRoute allow={["admin", "direction", "staff", "coach"]}><AthletesPage /></RoleRoute>} />
        <Route path="registrations" element={<RegistrationsPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="teams" element={<RoleRoute allow={["admin", "direction", "staff", "coach"]}><TeamsPage /></RoleRoute>} />
        <Route path="users" element={<RoleRoute allow={["admin", "direction"]}><UsersPage /></RoleRoute>} />
        <Route path="history" element={<RoleRoute allow={["admin", "direction", "staff"]}><HistoryPage /></RoleRoute>} />
        <Route path="feedback-admin" element={<RoleRoute allow={["admin", "direction"]}><FeedbackAdminPage /></RoleRoute>} />
        <Route path="finance" element={<RoleRoute allow={["admin", "direction", "staff"]}><FinancePage /></RoleRoute>} />
        <Route path="inventory" element={<RoleRoute allow={["admin", "direction", "staff"]}><InventoryPage /></RoleRoute>} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="download" element={<DownloadPage />} />
      </Route>
    </Routes>
  );
}
