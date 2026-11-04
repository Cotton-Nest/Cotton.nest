import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
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
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[320px] p-6 sm:p-10 flex flex-col items-center justify-center text-center bg-[#FAF7F2] rounded-3xl border border-[#DEC89B] my-6 shadow-sm mx-auto max-w-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#FDEAF0] text-[#8C2E46] flex items-center justify-center mb-4 border border-[#FAD1DC] shadow-xs">
            <AlertTriangle className="w-7 h-7 text-[#8C2E46]" />
          </div>
          <h2 className="font-serif-luxury text-2xl font-bold text-[#2C2420] mb-2">
            {this.props.fallbackTitle || 'A brief interruption occurred'}
          </h2>
          <p className="text-sm text-[#7A6458] max-w-md mb-6 leading-relaxed">
            We encountered an unexpected display hiccup while loading this section. Your cart, orders, and saved data remain intact.
          </p>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-[#70252D] hover:bg-[#591D24] text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Section</span>
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 bg-white hover:bg-[#F4EFE6] text-[#2C2420] border border-[#DEC89B] text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
            >
              <Home className="w-3.5 h-3.5 text-[#C29E57]" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
