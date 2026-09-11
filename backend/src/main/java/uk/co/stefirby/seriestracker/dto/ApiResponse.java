package uk.co.stefirby.seriestracker.dto;

public class ApiResponse<T> {
    private T data;
    private String error;
    private long count;

    // series_spec_062_rating_sort_missing_value_exclusion.md (SERIES-062-AC-07): the number of
    // series excluded from `data` for missing the field being sorted on. Defaults to 0, like
    // every other endpoint's response where it isn't meaningful -- never omitted.
    private long excludedCount;

    public ApiResponse() {}

    public ApiResponse(T data) {
        this.data = data;
        this.count = 1;
    }

    public ApiResponse(T data, long count) {
        this.data = data;
        this.count = count;
    }

    public ApiResponse(T data, long count, long excludedCount) {
        this.data = data;
        this.count = count;
        this.excludedCount = excludedCount;
    }

    public static <T> ApiResponse<T> error(String message) {
        ApiResponse<T> r = new ApiResponse<>();
        r.error = message;
        return r;
    }

    public T getData() { return data; }
    public void setData(T data) { this.data = data; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public long getCount() { return count; }
    public void setCount(long count) { this.count = count; }

    public long getExcludedCount() { return excludedCount; }
    public void setExcludedCount(long excludedCount) { this.excludedCount = excludedCount; }
}
