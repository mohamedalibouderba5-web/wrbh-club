import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppLayout } from "./layouts/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { InstallPage } from "./pages/InstallPage";
import { DashboardPage } from "./pages/DashboardPage";
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

function Private({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/install" element={<InstallPage />} />
      <Route path="/app" element={<InstallPage />} />
      <Route
        path="/"
        element={
          <Private>
            <AppLayout />
          </Private>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="athletes" element={<AthletesPage />} />
        <Route path="registrations" element={<RegistrationsPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="feedback-admin" element={<FeedbackAdminPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="download" element={<DownloadPage />} />
      </Route>
    </Routes>
  );
}
