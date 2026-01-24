/**
 * Custom error classes for different error types.
 */

export class IngestionError extends Error {
  constructor(
    message: string,
    public readonly supplierId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'IngestionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NormalizationError extends Error {
  constructor(
    message: string,
    public readonly rawOffer: unknown,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'NormalizationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class MatchingError extends Error {
  constructor(
    message: string,
    public readonly normalizedOfferId: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'MatchingError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ExportError extends Error {
  constructor(
    message: string,
    public readonly format: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ExportError';
    Error.captureStackTrace(this, this.constructor);
  }
}

