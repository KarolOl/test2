package pl.example.springtest.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import pl.example.springtest.dto.ProcessingResponseDto;
import pl.example.springtest.dto.ProcessingResponseDto.OverallStatus;
import pl.example.springtest.dto.ProcessingResponseDto.OptionalData;
import pl.example.springtest.dto.ProcessingResponseDto.ProcessingRecord;

@RestController
@RequestMapping("/api/files")
public class FileProcessingController {
    private final boolean includeSecondFile;

    public FileProcessingController(@Value("${app.processing.include-second-file:false}") boolean includeSecondFile) {
        this.includeSecondFile = includeSecondFile;
    }

    @PostMapping(path = "/process", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MultiValueMap<String, Object>> processFiles(
            @RequestPart("firstFile") MultipartFile firstFile,
            @RequestPart(value = "secondFile", required = false) MultipartFile secondFile
    ) {
        // Demonstration outputs are independent of the uploaded files.
        ProcessingResponseDto result = new ProcessingResponseDto(
                UUID.randomUUID().toString(),
                OverallStatus.VALID,
                List.of(
                        new ProcessingRecord("record-1", "VALID", "Przykładowy dokument", "Przykładowa osoba",
                                List.of("Wynik demonstracyjny - nie przeprowadzono weryfikacji dokumentu."), null),
                        new ProcessingRecord("record-2", "VALID", "Dokument z dodatkowymi danymi", "Anna Kowalska",
                                List.of("Wynik demonstracyjny - nie przeprowadzono weryfikacji dokumentu.",
                                        "Dodatkowe dane osoby są przykładowe i wymagają potwierdzenia."),
                                new OptionalData("Anna", "Kowalska", "Nowak", 34, "Warszawa", "00-001"))
                )
        );

        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("firstPdfFile", filePart("firstPdfFile", "raport.pdf", MediaType.APPLICATION_PDF,
                new ClassPathResource("demo/processing-report.pdf")));
        if (includeSecondFile) {
            parts.add("secondFile", filePart("secondFile", "wynik.json", MediaType.APPLICATION_JSON, result));
        }

        HttpHeaders jsonHeaders = new HttpHeaders();
        jsonHeaders.setContentType(MediaType.APPLICATION_JSON);
        parts.add("jsonResult", new HttpEntity<>(result, jsonHeaders));

        return ResponseEntity.ok()
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .cacheControl(CacheControl.noStore())
                .body(parts);
    }

    private HttpEntity<?> filePart(String partName, String filename, MediaType contentType, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(contentType);
        headers.setContentDisposition(ContentDisposition.formData().name(partName).filename(filename).build());
        return new HttpEntity<>(body, headers);
    }
}
