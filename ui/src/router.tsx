import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { ProtectedRoute } from "@/apps/auth/protected-route";

const LoginPage = lazy(() => import("./apps/auth/pages/login-page"));
const MachinesPage = lazy(() => import("./apps/machines/pages/machines-page"));
const ThreadsPage = lazy(() => import("./apps/threads/pages/threads-page"));
const ThreadViewPage = lazy(
  () => import("./apps/threads/pages/thread-view-page"),
);

export const Router = () => {
  return (
    <BrowserRouter>
      <Suspense>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/machines"
            element={
              <ProtectedRoute>
                <MachinesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/machines/:machineId/threads"
            element={
              <ProtectedRoute>
                <ThreadsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/threads/:threadId"
            element={
              <ProtectedRoute>
                <ThreadViewPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/machines" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
