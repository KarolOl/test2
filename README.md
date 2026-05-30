# Spring Boot 4 Multipart Demo

Minimalny projekt Maven dla Spring Boot 4 i Java 25.

## Uruchomienie

```powershell
mvn spring-boot:run
```

Po starcie aplikacji frontend jest dostepny pod adresem:

```text
http://localhost:8080/
```

## Endpoint

```http
POST /api/files/process
Content-Type: multipart/form-data
```

Pola formularza:

- `firstFile`
- `secondFile`

Odpowiedz:

```json
{
  "result": "Dummy processing completed for files: input.pdf and metadata.txt",
  "pdfFileInBase64": "..."
}
```

W dummy implementacji `pdfFileInBase64` jest Base64 z pierwszego przeslanego pliku.

## Endpoint TSL

```http
GET /api/tsl/revocation-endpoints
```

Endpoint pobiera `https://ec.europa.eu/tools/lotl/eu-lotl.xml`, wybiera polska liste TSL
(`SchemeTerritory = PL`) z lokacja konczaca sie na `.xml`, a potem wypisuje w konsoli adresy
CRL oraz OCSP znalezione w `ServiceSupplyPoint` uslug CRL/OCSP oraz w rozszerzeniach certyfikatow
`X509Certificate`. Uwzgledniane sa rowniez historyczne wpisy uslug (`ServiceHistoryInstance`).
Odpowiedz endpointu zawiera te same dane w JSON.
