import { type FormEvent, useState } from "react";
import { Navigate } from "react-router";

import { useAuth } from "@/apps/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/machines" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-bg relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="login-grid pointer-events-none absolute inset-0" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand */}
        <div className="login-reveal mb-12 text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <span className="bg-border h-px max-w-12 flex-1" />
            <span className="login-diamond text-muted-foreground text-[10px]">
              ◆
            </span>
            <span className="bg-border h-px max-w-12 flex-1" />
          </div>
          <h1 className="text-foreground text-[2rem] leading-none font-bold tracking-[0.3em] uppercase">
            dialga
          </h1>
          <p className="text-muted-foreground/70 mt-3 text-[11px] font-medium tracking-[0.15em] uppercase">
            Remote AI Agent Control
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="login-reveal-2 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="email"
              className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              className="h-11"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="password"
              className="text-muted-foreground text-[11px] font-medium tracking-[0.08em] uppercase"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11"
            />
          </div>

          {error && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="mt-1 h-11 text-[13px] font-semibold tracking-[0.08em] uppercase"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        {/* Footer */}
        <div className="login-reveal-3 mt-16 text-center">
          <p className="text-muted-foreground/30 text-[10px] tracking-[0.15em] uppercase">
            Manage your machines and AI agents
          </p>
        </div>
      </div>
    </div>
  );
}
