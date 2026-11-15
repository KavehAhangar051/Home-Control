"use client";

import React, { type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  resetKeys?: ReadonlyArray<unknown>;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  prevResetKeys?: ReadonlyArray<unknown>;
}

function areResetKeysEqual(
  prevKeys?: ReadonlyArray<unknown>,
  nextKeys?: ReadonlyArray<unknown>,
): boolean {
  if (prevKeys === nextKeys) return true;
  if (!prevKeys || !nextKeys || prevKeys.length !== nextKeys.length) return false;

  for (let i = 0; i < prevKeys.length; i++) {
    if (!Object.is(prevKeys[i], nextKeys[i])) return false;
  }

  return true;
}

/**
 * Reusable accessible RTL error boundary for isolating workspace engines,
 * settings panels, and drawers from crashing the entire dashboard.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
      prevResetKeys: props.resetKeys,
    };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (areResetKeysEqual(state.prevResetKeys, props.resetKeys)) {
      return null;
    }

    return state.hasError
      ? { hasError: false, errorMessage: "", prevResetKeys: props.resetKeys }
      : { prevResetKeys: props.resetKeys };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error.message || "خطای غیرمنتظره در رندر این بخش رخ داد.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught rendering error:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: "" });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle ?? "بروز خطا در نمایش این بخش";
    const description =
      this.props.fallbackDescription ??
      "در بارگذاری یا اجرای این قسمت مشکلی پیش آمد. می‌توانید دوباره تلاش کنید.";

    return (
      <div
        dir="rtl"
        role="alert"
        aria-live="assertive"
        className="mx-auto my-6 flex w-full max-w-lg flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-card-bg p-6 text-center shadow-sm"
      >
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
          <p className="text-xs leading-6 text-text-secondary">{description}</p>
          {this.state.errorMessage && (
            <p className="rounded-lg border border-border-color bg-bg-main px-3 py-1.5 font-mono text-[11px] text-text-muted break-words">
              {this.state.errorMessage}
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={this.handleReset}
          className="rounded-xl px-4 font-bold"
        >
          تلاش مجدد
        </Button>
      </div>
    );
  }
}
