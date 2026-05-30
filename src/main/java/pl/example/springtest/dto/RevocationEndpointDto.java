package pl.example.springtest.dto;

import java.util.List;

public record RevocationEndpointDto(
        String tslLocation,
        String certificateSubject,
        List<String> crlUrls,
        List<String> ocspUrls
) {
}
