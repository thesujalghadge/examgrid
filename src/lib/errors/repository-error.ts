export type RepositoryErrorCode =
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "STORAGE_CORRUPT"
  | "VALIDATION_FAILED"
  | "NOT_CONFIGURED"
  | "OPERATION_FAILED";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  readonly repository: string;
  readonly operation: string;
  readonly cause?: unknown;

  constructor(params: {
    code: RepositoryErrorCode;
    repository: string;
    operation: string;
    message: string;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "RepositoryError";
    this.code = params.code;
    this.repository = params.repository;
    this.operation = params.operation;
    this.cause = params.cause;
  }
}

export function isRepositoryError(error: unknown): error is RepositoryError {
  return error instanceof RepositoryError;
}

export function toRepositoryError(
  error: unknown,
  repository: string,
  operation: string,
): RepositoryError {
  if (isRepositoryError(error)) return error;
  const message =
    error instanceof Error ? error.message : "Unknown repository error";
  return new RepositoryError({
    code: "OPERATION_FAILED",
    repository,
    operation,
    message,
    cause: error,
  });
}
