package pl.example.springtest.controller;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import pl.example.springtest.dto.RevocationEndpointDto;
import pl.example.springtest.service.TslRevocationInfoService;

@RestController
@RequestMapping("/api/tsl")
public class TslRevocationInfoController {

    private final TslRevocationInfoService tslRevocationInfoService;

    public TslRevocationInfoController(TslRevocationInfoService tslRevocationInfoService) {
        this.tslRevocationInfoService = tslRevocationInfoService;
    }

    @GetMapping(path = "/revocation-endpoints", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<RevocationEndpointDto> printRevocationEndpoints() {
        return tslRevocationInfoService.printRevocationEndpointsFromEuLotl();
    }
}
