import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';

type Props = {
  children: ReactNode;
  /** Optional label for error reports (e.g. "Dashboard"). */
  scope?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.scope ? `: ${this.props.scope}` : ''}]`, error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = this.state.error.message || 'Something went wrong';

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Unexpected error</p>
        <h1 className="mt-3 font-display text-2xl font-bold text-brand sm:text-3xl">
          {this.props.scope ? `${this.props.scope} unavailable` : 'This page hit a snag'}
        </h1>
        <p className="mt-3 max-w-md text-sm text-text-muted">{message}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="accent" onClick={this.handleRetry}>
            Try again
          </Button>
          <Link to="/">
            <Button type="button" variant="secondary">
              Go home
            </Button>
          </Link>
        </div>
      </div>
    );
  }
}
