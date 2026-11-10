export class AppError extends Error {
  public readonly cause: unknown;
  public readonly code: string;
  public readonly status: number;

  public constructor(status: number, code: string, cause?: unknown) {
    super(code);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.cause = cause;
  }
}
