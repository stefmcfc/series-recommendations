package uk.co.stefirby.seriestracker.exception;

/**
 * Raised when a request conflicts with existing state: {@code POST /api/v1/series/refresh-all}
 * while a bulk refresh job is already {@code IN_PROGRESS} (SERIES-018-AC-14), or
 * {@code POST /api/v1/series} with an {@code imdbId} that already matches a tracked series
 * (SERIES-028-AC-01). Mapped by {@link GlobalExceptionHandler} to {@code 409 Conflict}.
 */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
