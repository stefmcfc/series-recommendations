export class ApiError extends Error {
  readonly isApiError = true as const
  readonly status: number
  readonly details?: Record<string, string>

  constructor(
    status: number,
    message: string,
    details?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}
