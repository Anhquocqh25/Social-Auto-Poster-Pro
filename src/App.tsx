import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { CalendarPage } from './pages/CalendarPage';
import { PostsPage } from './pages/PostsPage';
import { CreatePostPage } from './pages/CreatePostPage';
import { BulkCreatePage } from './pages/BulkCreatePage';
import { AccountsPage } from './pages/AccountsPage';
import { ConnectedChannelsPage } from './pages/ConnectedChannelsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { initializeTheme } from './store/useThemeStore';
import { initializeLanguage } from './store/useLanguageStore';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    initializeTheme();
    initializeLanguage();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="posts" element={<PostsPage />} />
          <Route path="create-post" element={<CreatePostPage />} />
          <Route path="connected-channels" element={<ConnectedChannelsPage />} />
          <Route path="bulk-create" element={<BulkCreatePage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />
        </Route>
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;