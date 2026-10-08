/** Thrown when no provisioning credentials are stored (or override missing). */
export class NotProvisionedError extends Error {
  constructor(message = "Provisioning required") {
    super(message);
    this.name = "NotProvisionedError";
  }
}

/**
 * A dadi service answered a request with an error status. Every request carries an
 * `X-Request-Id` the service logs as `request_id`, so `service` and `requestId` find the
 * service's own log line for this failure.
 */
export class ApiError extends Error {
  /** Loki service label: the first label of the base URL's host (`hath` for http://hath.dadi). */
  readonly service: string;
  /** The `X-Request-Id` this request was sent with. */
  readonly requestId: string;
  readonly status: number;
  /** When the failure came back (ISO). */
  readonly at: string;

  constructor(message: string, baseUrl: string, requestId: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.service = new URL(baseUrl).hostname.split(".")[0]!;
    this.requestId = requestId;
    this.status = status;
    this.at = new Date().toISOString();
  }
}
