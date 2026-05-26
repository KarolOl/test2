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
