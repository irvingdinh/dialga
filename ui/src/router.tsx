import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { ProtectedRoute } from "@/apps/auth/protected-route";
import { ErrorBoundary } from "@/components/error-boundary";

const LoginPage = lazy(() => import("./apps/auth/pages/login-page"));
const MachinesPage = lazy(() => import("./apps/machines/pages/machines-page"));
const MachineSettingsPage = lazy(
  () => import("./apps/machines/pages/machine-settings-page"),
);
const ThreadsPage = lazy(() => import("./apps/threads/pages/threads-page"));
const ThreadViewPage = lazy(
  () => import("./apps/threads/pages/thread-view-page"),
);

export const Router = () => {
  return (
    <BrowserRouter>
      <Suspense>
        <Routes>
          <Route
            path="/login"
            element={
              <ErrorBoundary>
                <LoginPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/machines"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <MachinesPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/machines/:machineId/settings"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <MachineSettingsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/machines/:machineId/threads"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <ThreadsPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/threads/:threadId"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <ThreadViewPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/machines" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
