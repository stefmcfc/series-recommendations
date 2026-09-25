package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.RefreshAllOptions;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.service.refresh.BulkRefreshService;
import uk.co.stefirby.seriestracker.service.refresh.RefreshJobStatus;
import uk.co.stefirby.seriestracker.service.refresh.RefreshResult;
import uk.co.stefirby.seriestracker.service.refresh.SeriesRefreshService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** TOOLING-002-AC-03/04: per-series and bulk refresh endpoints, extracted from {@code SeriesController}. */
@RestController
public class SeriesRefreshController implements SeriesRefreshControllerApi {

    private final SeriesRefreshService refreshService;
    private final BulkRefreshService bulkRefreshService;

    public SeriesRefreshController(SeriesRefreshService refreshService, BulkRefreshService bulkRefreshService) {
        this.refreshService = refreshService;
        this.bulkRefreshService = bulkRefreshService;
    }

    @Override
    public ResponseEntity<ApiResponse<RefreshResult>> refresh(UUID id) {
        RefreshResult result = refreshService.refresh(id);
        return ResponseEntity.ok(new ApiResponse<>(result));
    }

    @Override
    public ResponseEntity<ApiResponse<SeriesDto>> acknowledgeNewContent(UUID id) {
        SeriesDto dto = refreshService.acknowledgeNewContent(id);
        return ResponseEntity.ok(new ApiResponse<>(dto));
    }

    @Override
    public ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAll(RefreshAllOptions options) {
        Integer skipThresholdOverride = options != null ? options.skipThresholdMinutesOverride() : null;
        RefreshJobStatus status = bulkRefreshService.start(skipThresholdOverride);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new ApiResponse<>(status));
    }

    @Override
    public ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAllStatus() {
        return ResponseEntity.ok(new ApiResponse<>(bulkRefreshService.status()));
    }
}
