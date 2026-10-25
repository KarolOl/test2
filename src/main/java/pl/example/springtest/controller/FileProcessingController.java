package pl.example.springtest.controller;

import java.io.IOException;
import java.util.Base64;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import pl.example.springtest.dto.ProcessingResponseDto;

@RestController
@RequestMapping("/api/files")
public class FileProcessingController {

    @PostMapping(path = "/process", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ProcessingResponseDto processFiles(
            @RequestPart("firstFile") MultipartFile firstFile,
            @RequestPart(value = "secondFile", required = false) MultipartFile secondFile
    ) throws IOException {
        String firstName = safeOriginalFilename(firstFile);
        String pdfFileInBase64 = Base64.getEncoder().encodeToString(firstFile.getBytes());
        String result = secondFile == null
                ? "Dummy processing completed for file: %s".formatted(firstName)
                : "Dummy processing completed for files: %s and %s".formatted(firstName, safeOriginalFilename(secondFile));

        return new ProcessingResponseDto(
                result,
                pdfFileInBase64
        );
    }

    private String safeOriginalFilename(MultipartFile file) {
        String filename = file.getOriginalFilename();
        return filename == null || filename.isBlank() ? "unnamed-file" : filename;
    }
}
