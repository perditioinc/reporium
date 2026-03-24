'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Homepage render failed', error, info);
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
          <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center">
            <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 text-center shadow-2xl shadow-black/30">
              <h1 className="text-2xl font-semibold text-zinc-100">Something went wrong.</h1>
              <p className="mt-3 text-sm text-zinc-400">Please reload the page.</p>
              <button
                type="button"
                onClick={this.handleReload}
                className="mt-6 inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-700"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
