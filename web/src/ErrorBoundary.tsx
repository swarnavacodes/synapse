import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="canvas canvas--empty">
          <div>
            <p>This graph could not be rendered.</p>
            <button onClick={() => this.setState({ hasError: false })}>Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}