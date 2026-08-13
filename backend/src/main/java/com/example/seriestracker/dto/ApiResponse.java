package com.example.seriestracker.dto;

public class ApiResponse<T> {
    private T data;
    private String error;
    private long count;

    public ApiResponse() {}

    public ApiResponse(T data) {
        this.data = data;
        this.count = 1;
    }

    public ApiResponse(T data, long count) {
        this.data = data;
        this.count = count;
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
}
