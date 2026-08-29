import React from "react";
import { Routes, Route, Navigate . useloaction} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LoadingState } from "./components/ui/states";
import AppLayout from "./layouts/AppLayout";
import Landing from "./pages/Landing";
import Explore from "./pages/Explore";
import SharePlan from "./pages/SharePlan";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import CreateTrip from "./pages/CreateTrip";
import TripDetail from "./pages/TripDetail";
import Discover from "./pages/Discover";
import Nearby from "./pages/Nearby";
import Chat from "./pages/Chat";
import WhatNow from "./pages/WhatNow";
import TravelMode from "./pages/TravelMode";
import Documents from "./pages/Documents";
import Profile from "./pages/Profile";

function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready || user === null) return <LoadingState label="Getting things ready…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function PublicOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready || user === null) return <LoadingState />;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/share/:token" element={<SharePlan />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="create" element={<CreateTrip />} />
        <Route path="trips/:id" element={<TripDetail />} />
        <Route path="discover" element={<Discover />} />
        <Route path="nearby" element={<Nearby />} />
        <Route path="chat" element={<Chat />} />
        <Route path="what-now" element={<WhatNow />} />
        <Route path="documents" element={<Documents />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route
        path="/app/trips/:id/travel"
        element={
          <ProtectedRoute>
            <TravelMode />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
