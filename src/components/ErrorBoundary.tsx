import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Till App:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 border-2 border-amber-400 p-6 rounded shadow-xl text-center space-y-4">
            <div className="w-12 h-12 bg-amber-400 text-black font-serif font-bold text-2xl mx-auto flex items-center justify-center rounded">
              Δ
            </div>
            <h1 className="font-serif italic text-2xl font-bold text-amber-400">
              Daily Till Reconciliation
            </h1>
            <p className="text-zinc-300 text-sm">
              The application encountered a temporary glitch while loading data. Your saved records in local storage remain safe.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-black font-extrabold uppercase tracking-wider text-xs rounded transition-all cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}



