package com.example.seriestracker.exception;

/**
 * Raised when a call to an external, upstream service (e.g. the OMDb API) fails for a
 * reason unrelated to the request itself -- the upstream is unreachable, times out,
 * returns an unexpected non-2xx status, or returns a response this app can't parse.
 *
 * <p>Distinct from {@link EntityNotFoundException}: "the upstream has no result for this
 * request" is a normal, expected 404. "The upstream itself is the problem" is a different
 * failure mode, mapped by {@link GlobalExceptionHandler} to {@code 502 Bad Gateway}.
 */
public class ExternalServiceException extends RuntimeException {

    public ExternalServiceException(String message) {
        super(message);
    }

    public ExternalServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
