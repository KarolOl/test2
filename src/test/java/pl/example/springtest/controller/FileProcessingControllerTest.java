package pl.example.springtest.controller;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FileProcessingController.class)
class FileProcessingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldAcceptTwoMultipartFilesAndReturnDto() throws Exception {
        MockMultipartFile firstFile = new MockMultipartFile(
                "firstFile",
                "input.pdf",
                MediaType.APPLICATION_PDF_VALUE,
                "pdf-content".getBytes()
        );
        MockMultipartFile secondFile = new MockMultipartFile(
                "secondFile",
                "metadata.txt",
                MediaType.TEXT_PLAIN_VALUE,
                "text-content".getBytes()
        );

        mockMvc.perform(multipart("/api/files/process")
                        .file(firstFile)
                        .file(secondFile))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result", containsString("input.pdf")))
                .andExpect(jsonPath("$.result", containsString("metadata.txt")))
                .andExpect(jsonPath("$.pdfFileInBase64").value("cGRmLWNvbnRlbnQ="));
    }
}
