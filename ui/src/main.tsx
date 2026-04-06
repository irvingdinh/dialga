import "./styles/globals.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider } from "@/apps/auth/auth-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/sonner";
import { ConnectionProvider } from "@/lib/connection";
import { MachineStatusProvider } from "@/lib/machine-status";
import { ThemeProvider } from "@/lib/theme";
import { UnreadProvider } from "@/lib/unread";

import { Router } from "./router";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ConnectionProvider>
              <MachineStatusProvider>
                <UnreadProvider>
                  <Router />
                  <Toaster position="top-center" />
                </UnreadProvider>
              </MachineStatusProvider>
            </ConnectionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);
