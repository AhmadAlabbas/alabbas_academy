export type AccountErrorCode = 'INVALID_INPUT' | 'INVALID_CREDENTIALS' | 'INVALID_TOKEN' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVICE_UNAVAILABLE';

export class AccountError extends Error {
  constructor(public readonly code: AccountErrorCode, public readonly status: number, public readonly fieldErrors?: Record<string,string[]>) {
    super(code);
    this.name = 'AccountError';
  }
}
