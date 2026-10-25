# Frontend Angular

Osobny frontend Angular dla aplikacji Spring Boot z katalogu nadrzędnego. Zawiera logowanie przez Keycloak, wybór pierwszego pliku i opcjonalnego drugiego pliku (również metodą drag-and-drop), wysyłkę multipart oraz pobieranie pliku PDF zwróconego jako Base64.

## Wymagania

- Node.js 22.22.3+ (linia 22), 24.15+ (linia 24) lub 26+
- działający backend Spring Boot pod `http://localhost:8080`
- Keycloak pod `http://localhost:8085`, realm `test`, klient publiczny `test-public`

Klient Keycloak powinien akceptować adres przekierowania `http://localhost:4200/*` i web origin `http://localhost:4200`.

## Uruchomienie

W pierwszym terminalu, w katalogu głównym repozytorium:

```powershell
mvn spring-boot:run
```

W drugim terminalu:

```powershell
cd frontend-angular
npm install
npm start
```

Aplikacja będzie dostępna pod `http://localhost:4200`. Żądania `/api` są przekazywane przez `proxy.conf.json` do backendu na porcie 8080.

## Settings ładowane przy uruchomieniu

Aplikacja pobiera `settings.json` przed uruchomieniem Angulara i logowaniem do Keycloak, a następnie wstrzykuje zweryfikowaną konfigurację przez `APP_SETTINGS`. Podczas pracy lokalnej edytuj `public/settings.json` i odśwież stronę. Nieprawidłowa lub niedostępna konfiguracja powoduje wyświetlenie komunikatu na stronie.

```json
{
  "appTitle": "Przetwarzanie plików",
  "apiBaseUrl": "/api",
  "keycloak": {
    "url": "http://localhost:8085",
    "realm": "test",
    "clientId": "test-public"
  },
  "fileExtensions": {
    "firstFile": [".pdf"],
    "secondFile": [".xml"]
  }
}
```

- `appTitle` — jedyny tytuł widoczny w panelu i tytuł karty przeglądarki.
- `apiBaseUrl` — bazowy adres API, bez końcowego `/files/process`. Może być ścieżką `/api` albo pełnym adresem HTTP(S) dostępnym z przeglądarki. Przy innym originie backend musi obsługiwać CORS.
- `keycloak` — adres Keycloak dostępny z przeglądarki, realm i identyfikator klienta publicznego.
- `fileExtensions.firstFile` i `fileExtensions.secondFile` — osobne listy dozwolonych rozszerzeń dla obu pól. Rozszerzenia mogą mieć kropkę lub jej nie mieć; wielkość liter nie ma znaczenia. Obsługiwane są też rozszerzenia złożone, np. `.tar.gz`. Pusta lista `[]` dopuszcza dowolne rozszerzenia w danym polu.

Pierwszy plik jest wymagany, a drugi jest opcjonalny. Walidacja rozszerzenia drugiego pliku działa tylko wtedy, gdy zostanie wybrany; jego brak pomija również pole `secondFile` w żądaniu multipart.

Walidacja działa przy wyborze z dysku, przeciąganiu pliku oraz przed wysłaniem formularza. Niedozwolony plik jest odrzucany, a komunikat pojawia się nad formularzem. Atrybut `accept` filtruje również systemowe okno wyboru plików. To walidacja nazwy pliku po stronie interfejsu; nie sprawdza jego zawartości. Settings są publicznie dostępne w przeglądarce i nie służą do przechowywania sekretów.

## Kontener nginx

`Dockerfile` buduje frontend w etapie Node.js i serwuje go przez nginx. Poniższe polecenia wykonuj w katalogu `frontend-angular`:

```powershell
docker build -t spring-test-frontend .
docker run --rm -p 4200:80 -e API_UPSTREAM=http://host.docker.internal:8080 spring-test-frontend
```

Domyślna konfiguracja pochodzi z `public/settings.json`. nginx udostępnia aplikację pod `http://localhost:4200`, obsługuje ścieżki Angulara oraz przekazuje `/api/` do backendu. `API_UPSTREAM` to adres backendu widoczny z kontenera, bez końcowego ukośnika i bez ścieżki `/api`, np. `http://backend:8080` w sieci Docker. Na Docker Desktop domyślny `http://host.docker.internal:8080` wskazuje backend uruchomiony na hoście. Na Linuxie można dodać `--add-host host.docker.internal:host-gateway`. Limit całego żądania w nginx wynosi 40 MB, zgodnie z obecną konfiguracją backendu.

### Settings jako zamontowany JSON

Przygotuj kopię konfiguracji i zmień w niej potrzebne wartości:

```powershell
Copy-Item public/settings.json settings.container.json
docker run --rm -p 4200:80 --mount "type=bind,source=${PWD}/settings.container.json,target=/etc/app/settings.json,readonly" -e API_UPSTREAM=http://host.docker.internal:8080 spring-test-frontend
```

Plik montowany jest tylko do odczytu. Opcjonalne `SETTINGS_FILE` pozwala wskazać inną ścieżkę pliku wewnątrz kontenera; jawnie wskazany plik musi istnieć.

### Settings jako zmienna środowiskowa

```powershell
$env:SETTINGS_JSON = Get-Content settings.container.json -Raw
docker run --rm -p 4200:80 -e SETTINGS_JSON -e API_UPSTREAM=http://host.docker.internal:8080 spring-test-frontend
Remove-Item Env:SETTINGS_JSON
```

`SETTINGS_JSON` zawiera pełny obiekt JSON, a nie ścieżkę do pliku. Kolejność wyboru konfiguracji: `SETTINGS_JSON`, następnie plik wskazany przez `SETTINGS_FILE` lub domyślny `/etc/app/settings.json`, następnie konfiguracja z obrazu. Konfiguracje zastępują się w całości, nie są scalane. Niepoprawny JSON zatrzymuje start kontenera; strukturę i wartości ustawień weryfikuje też frontend.

nginx generuje publiczny `settings.json` przy każdym starcie kontenera i wyłącza jego buforowanie. Zmiana ustawień wymaga ponownego uruchomienia kontenera i odświeżenia strony, bez ponownego budowania obrazu.

## Struktura komponentów

- `App` — wczytanie profilu zalogowanego użytkownika, wysyłka do API i cykl życia adresu pobierania PDF.
- `UserMenu` — avatar i menu użytkownika.
- `FileUploadForm` — wybór wymaganego pierwszego pliku i opcjonalnego drugiego oraz walidacja formularza.
- `FileDropzone` — wielokrotnie używane pole wyboru pliku z drag-and-drop.
- `ProcessingResult` — odpowiedź API i link do PDF.
- `LoadingSpinner` — `ngx-spinner` z animacją `square-spin` (rotating cube), widoczny podczas logowania i przetwarzania plików.

## Style i kolory

Układ responsywny, odstępy, przyciski, formularze, komunikaty i menu korzystają z klas Bootstrap 5. Bootstrap jest instalowany lokalnie przez npm i importowany w `src/styles.scss`, bez zależności od CDN. Menu otwiera Angular, więc skrypty JavaScript Bootstrapa nie są potrzebne.

Wspólna paleta znajduje się w `src/styles/_variables.scss` i konfiguruje również motyw Bootstrapa. Własne style komponentów pozostają tylko dla przeciągania plików i animowanego avatara. Spinner korzysta z kolorów globalnych. Nagłówek zawiera placeholder logo po lewej; przyciski wysyłania i pobierania są wyrównane do prawej. Nowe komponenty generowane przez Angular CLI domyślnie otrzymują SCSS, a generowanie plików testowych jest wyłączone dla komponentów, serwisów i interceptorów.

## Licencja

Frontend Angular jest udostępniany na licencji Apache License 2.0 (`Apache-2.0`). Pełny tekst znajduje się w [public/LICENSE](public/LICENSE), dostępnym także przez odnośnik w stopce aplikacji. Zależności zachowują własne licencje.

## Uwierzytelnianie i ładowanie

Integracja korzysta z `keycloak-angular` 22 i adaptera `keycloak-js`. Po pobraniu settings funkcja `createAppConfig` rejestruje `provideKeycloak` z `initOptions` (`login-required`, `checkLoginIframe: false`). Biblioteka inicjalizuje klienta podczas startu Angulara; aplikacja nie tworzy własnej instancji Keycloak i nie wywołuje ręcznie `init()`.

`includeBearerTokenInterceptor` dodaje nagłówek `Authorization: Bearer ...` tylko do skonfigurowanego `apiBaseUrl` i jego podścieżek. Dla względnego `/api` obsługuje też pełne adresy z tym samym originem. Dopasowanie zachowuje granicę ścieżki: np. `/api-other` i adresy innych serwerów nie otrzymują tokenu. Interceptor biblioteki sprawdza i w razie potrzeby odświeża token przed żądaniem; formularz i `FileProcessingService` nie pobierają ani nie przekazują tokenu ręcznie.

`withAutoRefreshToken`, `AutoRefreshTokenService` i `UserActivityService` automatycznie odnawiają token przy kolejnych zdarzeniach jego wygaśnięcia, również bez wywołań API i interakcji użytkownika. `sessionTimeout: Number.POSITIVE_INFINITY` wyłącza limit bezczynności po stronie interfejsu w używanej wersji biblioteki. `onInactivityTimeout: 'logout'` pozostaje obsługą błędu automatycznego odświeżenia. Nadal obowiązują limity sesji skonfigurowane na serwerze Keycloak; uśpienie przeglądarki może opóźnić odświeżanie. Nie ma własnego interwału ani ręcznego wywołania `updateToken()` w kodzie aplikacji.

`AuthenticationService` wstrzykuje wspólną instancję Keycloak i `KEYCLOAK_EVENT_SIGNAL`. Udostępnia wyliczany sygnał `isAuthenticated`, pobiera profil (z awaryjnym odczytem claims tokenu) i obsługuje wylogowanie. Zawartość `main` jest renderowana wyłącznie dla zalogowanych użytkowników. Błędy logowania są wyświetlane poza chronioną zawartością. Serwis nie nadpisuje callbacków adaptera, z których korzysta biblioteka.

`loadingInterceptor` jest zarejestrowany przed interceptorem Bearer. `LoadingService` zlicza aktywne subskrypcje żądań: spinner pozostaje widoczny do zakończenia ostatniej z nich, również przy oczekiwaniu na odświeżenie tokenu, błędach i anulowaniu. Inicjalizacja Keycloak odbywa się przed renderowaniem Angulara; osobny `isInitializing` dotyczy pobierania profilu użytkownika po zalogowaniu. `isSubmitting` blokuje ponowne wysłanie formularza, ale nie steruje spinnerem.
