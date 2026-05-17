"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import { isRepositoryError } from "@/lib/errors/repository-error";

export interface AppErrorBoundaryProps {
  children: ReactNode;
  /** e.g. admin, cbt, repository */
  scope: string;
  title?: string;
  description?: string;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logRepositoryFailure(
      `error-boundary:${this.props.scope}`,
      { error, componentStack: info.componentStack },
    );
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const title = this.props.title ?? "Something went wrong";
    const description =
      this.props.description ??
      "An unexpected error occurred. Your exam progress may still be saved locally.";

    const detail = isRepositoryError(error)
      ? `${error.repository}.${error.operation}: ${error.message}`
      : error.message;

    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">{description}</p>
            <p className="rounded bg-red-50 p-3 text-xs font-mono text-red-800 break-all">
              {detail}
            </p>
            <div className="flex gap-2">
              <Button onClick={this.handleReset}>Try again</Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
