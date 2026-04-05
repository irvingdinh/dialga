import { AlertCircleIcon, RotateCcwIcon } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-dvh items-center justify-center px-4">
          <div className="flex max-w-sm flex-col items-center text-center">
            <AlertCircleIcon className="text-muted-foreground/40 mb-3 size-8" />
            <p className="text-sm font-medium">Something went wrong</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={this.handleReset}>
                <RotateCcwIcon className="mr-1.5 size-3.5" />
                Try again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = "/machines";
                }}
              >
                Go home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
