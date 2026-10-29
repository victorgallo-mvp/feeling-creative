import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './app/AuthContext';
import { Toaster } from './components/ui';
import { Login } from './app/Login';
import { Layout } from './app/Layout';
import { KanbanPage } from './app/kanban/KanbanPage';
import { ClientsPage } from './app/clients/ClientsPage';
import { ClientPage } from './app/clients/ClientPage';
import { BatchPage } from './app/batches/BatchPage';
import { NotificationsPage } from './app/notifications/NotificationsPage';
import { FeedbacksPage } from './app/feedbacks/FeedbacksPage';
import { HistoryPage } from './app/history/HistoryPage';
import { SettingsPage } from './app/settings/SettingsPage';
import { ApprovePage } from './approve/ApprovePage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<Layout />}>
          <Route index element={<KanbanPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="clientes/:id" element={<ClientPage />} />
          <Route path="lotes/:id" element={<BatchPage />} />
          <Route path="notificacoes" element={<NotificationsPage />} />
          <Route path="feedbacks" element={<FeedbacksPage />} />
          <Route path="historico" element={<HistoryPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
        </Route>
        <Route path="/a/:token" element={<ApprovePage />} />
        <Route path="*" element={<div className="p-10 text-center text-neutral-500">Página não encontrada</div>} />
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}
