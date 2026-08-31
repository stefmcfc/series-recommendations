package uk.co.stefirby.seriestracker.controller;

import uk.co.stefirby.seriestracker.dto.ApiResponse;
import uk.co.stefirby.seriestracker.dto.SeriesDto;
import uk.co.stefirby.seriestracker.service.refresh.BulkRefreshService;
import uk.co.stefirby.seriestracker.service.refresh.RefreshJobStatus;
import uk.co.stefirby.seriestracker.service.refresh.RefreshResult;
import uk.co.stefirby.seriestracker.service.refresh.SeriesRefreshService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** TOOLING-002-AC-03/04: per-series and bulk refresh endpoints, extracted from {@code SeriesController}. */
@RestController
@RequestMapping("/api/v1/series")
public class SeriesRefreshController {

    private final SeriesRefreshService refreshService;
    private final BulkRefreshService bulkRefreshService;

    public SeriesRefreshController(SeriesRefreshService refreshService, BulkRefreshService bulkRefreshService) {
        this.refreshService = refreshService;
        this.bulkRefreshService = bulkRefreshService;
    }

    @PostMapping("/" + UuidPathPattern.PATTERN + "/refresh")
    public ResponseEntity<ApiResponse<RefreshResult>> refresh(@PathVariable UUID id) {
        RefreshResult result = refreshService.refresh(id);
        return ResponseEntity.ok(new ApiResponse<>(result));
    }

    @PostMapping("/" + UuidPathPattern.PATTERN + "/acknowledge-new-content")
    public ResponseEntity<ApiResponse<SeriesDto>> acknowledgeNewContent(@PathVariable UUID id) {
        SeriesDto dto = refreshService.acknowledgeNewContent(id);
        return ResponseEntity.ok(new ApiResponse<>(dto));
    }

    @PostMapping("/refresh-all")
    public ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAll() {
        RefreshJobStatus status = bulkRefreshService.start();
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new ApiResponse<>(status));
    }

    @GetMapping("/refresh-all/status")
    public ResponseEntity<ApiResponse<RefreshJobStatus>> refreshAllStatus() {
        return ResponseEntity.ok(new ApiResponse<>(bulkRefreshService.status()));
    }
}
