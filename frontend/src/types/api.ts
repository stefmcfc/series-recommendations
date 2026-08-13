export interface ApiResponse<T> {
  data: T
  count?: number
}

export class ApiError extends Error {
  readonly isApiError = true as const

  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  state: LoadingState
  data: T | null
  error: ApiError | null
}