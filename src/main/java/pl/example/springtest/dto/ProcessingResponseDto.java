package pl.example.springtest.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

public record ProcessingResponseDto(
        String id,
        OverallStatus overallStatus,
        List<ProcessingRecord> records
) {
    public enum OverallStatus {
        VALID,
        INVALID
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ProcessingRecord(String id, String status, String subject, String preson, List<String> warns, OptionalData optinalData) {
    }

    public record OptionalData(String firstName, String lastName, String surname, int age, String city, String postalCode) {
    }
}
