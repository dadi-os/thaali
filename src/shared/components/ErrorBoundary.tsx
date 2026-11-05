import { Component, type ErrorInfo, type ReactNode } from "react";
import { ApiError } from "../api/errors";
import { logLine } from "../lib/log";
import { failureFacts } from "./states/failure";
import { StateView } from "./ModuleState";

export type ErrorBoundaryProps = {
  /** The unit guarded, as the user knows it ("Ghar", "hath"); heads the failure view. */
  label: string;
  /** Tile scale for the failure view. */
  compact?: boolean;
  children: ReactNode;
};

type ErrorBoundaryState = {
  /** What the children threw while rendering; null while they render. */
  caught: { error: unknown } | null;
};

/**
 * Keeps a render failure inside the unit that threw: the unit shows the thrown error's own
 * message in the error state view, with a retry that renders it afresh, and the failure is
 * logged with its component stack, while everything around it keeps working.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { caught: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { caught: { error } };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    logLine("error", `${this.props.label} failed to render: ${failureFacts(error).message}${info.componentStack}`, "render_failed");
  }

  render() {
    const { caught } = this.state;
    if (!caught) {
      return this.props.children;
    }
    const { error } = caught;
    return (
      <StateView
        kind="error"
        title={`${this.props.label} could not render`}
        detail={failureFacts(error).message}
        service={error instanceof ApiError ? error.service : undefined}
        status={error instanceof ApiError ? error.status : undefined}
        requestId={error instanceof ApiError ? error.requestId : undefined}
        compact={this.props.compact}
        onRetry={() => this.setState({ caught: null })}
      />
    );
  }
}
