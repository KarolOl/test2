package pl.example.springtest.dto;

public record ProcessingResponseDto(
        String result,
        String pdfFileInBase64
) {
}
