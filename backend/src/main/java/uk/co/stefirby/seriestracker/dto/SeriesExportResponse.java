package uk.co.stefirby.seriestracker.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;
import java.util.List;

public class SeriesExportResponse {

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'")
    private LocalDateTime exportDate;
    private List<SeriesDto> series;
    private long count;

    public SeriesExportResponse() {}

    public SeriesExportResponse(LocalDateTime exportDate, List<SeriesDto> series, long count) {
        this.exportDate = exportDate;
        this.series = series;
        this.count = count;
    }

    public LocalDateTime getExportDate() { return exportDate; }
    public void setExportDate(LocalDateTime exportDate) { this.exportDate = exportDate; }
    public List<SeriesDto> getSeries() { return series; }
    public void setSeries(List<SeriesDto> series) { this.series = series; }
    public long getCount() { return count; }
    public void setCount(long count) { this.count = count; }
}
