package uk.co.stefirby.seriestracker.service;

/**
 * Marker interface implemented by both {@code ImportJobStatus} and {@code RefreshJobStatus}
 * (chore/sonar-cleanup) so {@link AbstractPollingJobService} can operate on either job-status
 * record's shared {@code status} accessor without knowing which record it's holding.
 */
public interface JobStatus {
    String status();
}
