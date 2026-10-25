package pl.example.springtest.controller;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FileProcessingController.class)
@TestPropertySource(properties = "app.processing.include-second-file=true")
class FileProcessingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldReturnMultipartFilesWithFilenamesAndJsonResult() throws Exception {
        MockMultipartFile firstFile = inputFile("firstFile", "input.pdf");
        MockMultipartFile secondFile = inputFile("secondFile", "metadata.xml");

        mockMvc.perform(multipart("/api/files/process")
                        .file(firstFile)
                        .file(secondFile)
                        .accept(MediaType.MULTIPART_FORM_DATA))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.MULTIPART_FORM_DATA))
                .andExpect(content().string(containsString("name=\"firstPdfFile\"; filename=\"raport.pdf\"")))
                .andExpect(content().string(containsString("Content-Type: application/pdf")))
                .andExpect(content().string(containsString("%PDF-")))
                .andExpect(content().string(containsString("name=\"secondFile\"; filename=\"wynik.json\"")))
                .andExpect(content().string(containsString("name=\"jsonResult\"")))
                .andExpect(content().string(containsString("\"overallStatus\":\"VALID\"")))
                .andExpect(content().string(containsString("\"preson\":")));
    }

    @Test
    void shouldIncludeConfiguredOutputFileWithoutSecondInputFile() throws Exception {
        mockMvc.perform(multipart("/api/files/process")
                        .file(inputFile("firstFile", "input.pdf"))
                        .accept(MediaType.MULTIPART_FORM_DATA))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.MULTIPART_FORM_DATA))
                .andExpect(content().string(containsString("name=\"secondFile\"; filename=\"wynik.json\"")));
    }

    @Test
    void shouldOmitDisabledOutputFileEvenWithSecondInputFile() {
        var response = new FileProcessingController(false).processFiles(
                inputFile("firstFile", "input.pdf"), inputFile("secondFile", "metadata.xml"));
        var parts = response.getBody();
        assertNotNull(parts);
        assertTrue(parts.containsKey("firstPdfFile"));
        assertTrue(parts.containsKey("jsonResult"));
        assertFalse(parts.containsKey("secondFile"));
    }

    @Test
    void shouldRequireFirstInputFile() throws Exception {
        mockMvc.perform(multipart("/api/files/process")
                        .file(inputFile("secondFile", "metadata.xml")))
                .andExpect(status().isBadRequest());
    }

    private static MockMultipartFile inputFile(String partName, String filename) {
        return new MockMultipartFile(partName, filename, MediaType.APPLICATION_OCTET_STREAM_VALUE,
                new byte[] { 0, 1, 2, (byte) 255 });
    }
}
