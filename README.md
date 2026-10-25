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

Osobna wersja frontendu w Angularze znajduje sie w katalogu `frontend-angular`.
Instrukcja uruchomienia jest dostepna w `frontend-angular/README.md`.

## Endpoint

```http
POST /api/files/process
Content-Type: multipart/form-data
```

Pola formularza:

- `firstFile` — wymagany
- `secondFile` — opcjonalny

Odpowiedz ma typ `multipart/form-data; boundary=...` i zawiera części:

| Nazwa części   | Typ                                              | Obecność    |
| -------------- | ------------------------------------------------ | ----------- |
| `firstPdfFile` | binarny PDF, `Content-Disposition` z `filename`  | zawsze      |
| `secondFile`   | plik binarny, `Content-Disposition` z `filename` | opcjonalnie |
| `jsonResult`   | `application/json`                               | zawsze      |

Przykładowa zawartość części `jsonResult`:

```json
{
  "id": "identyfikator-wyniku",
  "overallStatus": "VALID",
  "warns": [
    "Wynik demonstracyjny - nie przeprowadzono weryfikacji dokumentów."
  ],
  "records": [
    {
      "id": "record-1",
      "status": "VALID",
      "subject": "Przykładowy dokument",
      "preson": "Przykładowa osoba"
    }
  ]
}
```

`overallStatus` przyjmuje `VALID` lub `INVALID`. Pisownia `preson` jest częścią kontraktu API.

Pliki wyjściowe są niezależne od uploadu, również od obecności opcjonalnego wejściowego `secondFile`. Backend demonstracyjny zawsze zwraca własny przykładowy PDF jako `firstPdfFile` z nazwą `raport.pdf`. Nie wykonuje rzeczywistej weryfikacji dokumentów; wynik i rekord są przykładowe.

Ustawienie backendu w `src/main/resources/application.properties`:

```properties
app.processing.include-second-file=false
```

Po ustawieniu `true` backend dołącza dodatkową część `secondFile` z nazwą `wynik.json`, zawierającą przykładowy wynik JSON. Nie wymaga to przesłania drugiego pliku wejściowego. Przy `false` część `secondFile` jest całkowicie pomijana. Nazwy i typy plików frontend odczytuje z części odpowiedzi, a nie z uploadu.

## Endpoint TSL

```http
GET /api/tsl/revocation-endpoints
```

Endpoint pobiera `https://ec.europa.eu/tools/lotl/eu-lotl.xml`, wybiera polska liste TSL
(`SchemeTerritory = PL`) z lokacja konczaca sie na `.xml`, a potem wypisuje w konsoli adresy
CRL oraz OCSP znalezione w `ServiceSupplyPoint` uslug CRL/OCSP oraz w rozszerzeniach certyfikatow
`X509Certificate`. Uwzgledniane sa rowniez historyczne wpisy uslug (`ServiceHistoryInstance`).
Odpowiedz endpointu zawiera te same dane w JSON.
