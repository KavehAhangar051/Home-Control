"use client";

import React, { type ErrorInfo, type ReactNode } from "react";

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
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "خطای غیرمنتظره در رندر این بخش رخ داد.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught rendering error:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && !areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false, errorMessage: "" });
    }
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
        className="mx-auto my-6 flex w-full max-w-lg flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/30 bg-[var(--card-bg)] p-6 text-center shadow-sm"
      >
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
          <p className="text-xs leading-6 text-[var(--text-secondary)]">{description}</p>
          {this.state.errorMessage && (
            <p className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-1.5 font-mono text-[11px] text-[var(--text-muted)] break-words">
              {this.state.errorMessage}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={this.handleReset}
          className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-[var(--accent3)] px-4 text-xs font-bold text-[var(--accent3-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent3)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-main)]"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }
}
