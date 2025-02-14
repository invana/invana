
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NotFoundPage from './pages/404/404';
import ConnectPage from "./pages/connect/connect";
import ProtectedRoute from "./pages/protected-route";
import ModellerPage from "./pages/modeller/modeller";
import ExplorerPage from "./pages/explorer/explorer";
import { LANDING_ROUTE } from './constants';
import '@invana/config-tailwind/index.css';
import '@invana/canvas-graph/index.css';
import { TestPage2 } from './pages/test-page/test-page2';
import { TestPage } from './pages/test-page/test-page';

const App = () => {
  return (
    <Router>
      <Routes>

        <Route path="/" element={<ProtectedRoute><Navigate to={LANDING_ROUTE} /></ProtectedRoute>} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/modeller" element={<ProtectedRoute><ModellerPage /></ProtectedRoute>} />
        <Route path="/explorer" element={<ProtectedRoute><ExplorerPage /></ProtectedRoute>} />
        <Route path="/graph/:graphId" element={<ProtectedRoute><ExplorerPage /></ProtectedRoute>} />
        <Route path="/test-page2" element={<ProtectedRoute><TestPage2 /></ProtectedRoute>} />
        <Route path="/test-page" element={<ProtectedRoute><TestPage /></ProtectedRoute>} />

        {/* Other routes */}
        <Route path="*" element={<NotFoundPage />} />  {/* Catch-all route for 404 */}

      </Routes>
    </Router>
  );
};

export default App;

