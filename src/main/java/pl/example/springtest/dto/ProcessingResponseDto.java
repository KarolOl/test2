package pl.example.springtest.dto;

import java.util.List;

public record ProcessingResponseDto(
        String id,
        OverallStatus overallStatus,
        List<String> warns,
        List<ProcessingRecord> records
) {
    public enum OverallStatus {
        VALID,
        INVALID
    }

    public record ProcessingRecord(String id, String status, String subject, String preson) {
    }
}
