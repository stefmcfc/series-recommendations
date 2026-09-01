package uk.co.stefirby.seriestracker.exception;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiResponse<Void>> handleConflict(ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<ApiResponse<Void>> handleExternalServiceException(ExternalServiceException ex) {
        log.error("External service call failed", ex);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
            .body(ApiResponse.error("Unable to reach the series lookup service. Please try again."));
    }

    // Without this explicit handler, this class's own catch-all Exception.class handler
    // below (matched via ExceptionHandlerExceptionResolver, which runs ahead of Spring
    // MVC's built-in default exception handling) would intercept a missing required
    // @RequestParam and turn what should be a 400 into a 500 -- see SERIES-005-AC-18.
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingRequestParameter(MissingServletRequestParameterException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.error(ex.getMessage()));
    }

    // A query param that fails Spring's own conversion (e.g. a non-numeric value for a
    // typed Integer/BigDecimal @RequestParam, such as GET /recommendations?yearMin=abc,
    // SERIES-007-AC-31) is caught here instead of falling through to the catch-all
    // Exception.class handler below, which would otherwise turn it into a 500 -- same
    // rationale as the MissingServletRequestParameterException handler above.
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.error("Invalid value for parameter '" + ex.getName() + "'"));
    }

    // SERIES-017-AC-01/05: without this explicit handler, an unmapped path (e.g. the
    // now-removed GET /api/v1/series/lookup, GET /api/v1/series/lookup/search) falls through
    // to this class's own catch-all Exception.class handler below and becomes a 500, instead
    // of the 404 a genuinely nonexistent route should return.
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFound(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ApiResponse.error("Not found"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.error(message));
    }

    // SERIES-041-AC-01: a jakarta.validation.ConstraintViolationException is thrown by
    // Hibernate when a SeriesEntity's own @Min/@Max/@DecimalMin/@DecimalMax constraint is
    // violated -- e.g. an out-of-range totalSeasons via update, which never went through
    // validateCreate's manual checks. Without this handler it falls through to the catch-all
    // Exception.class handler below and becomes a 500.
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        String message = ex.getConstraintViolations().stream()
            .map(v -> v.getPropertyPath() + ": " + v.getMessage())
            .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.error(message));
    }

    // SERIES-041-AC-01: because a new/managed entity's actual INSERT/UPDATE is deferred until
    // flush time, and @Transactional's own flush-then-commit happens inside
    // JpaTransactionManager.doCommit (after the annotated service method has already
    // returned), Hibernate's ConstraintViolationException doesn't reach the handler above
    // directly -- Spring wraps it (via a RollbackException) in a TransactionSystemException
    // first. Unwrap it here and delegate to the same handling as a directly-thrown
    // ConstraintViolationException; anything else is a genuine unexpected transactional
    // failure, left to the catch-all Exception.class handler below.
    @ExceptionHandler(TransactionSystemException.class)
    public ResponseEntity<ApiResponse<Void>> handleTransactionSystemException(TransactionSystemException ex) {
        if (ex.getRootCause() instanceof ConstraintViolationException cve) {
            return handleConstraintViolation(cve);
        }
        return handleUnexpected(ex);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex) {
        log.error("Unhandled exception while processing request", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse.error("Internal server error"));
    }
}
