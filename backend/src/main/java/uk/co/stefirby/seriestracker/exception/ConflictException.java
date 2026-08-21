package uk.co.stefirby.seriestracker.exception;

/**
 * Raised when a request conflicts with an already-in-progress operation -- currently only
 * {@code POST /api/v1/series/refresh-all} while a bulk refresh job is already {@code
 * IN_PROGRESS} (SERIES-018-AC-14). Mapped by {@link GlobalExceptionHandler} to {@code 409
 * Conflict}.
 */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
