import Keycloak from "https://cdn.jsdelivr.net/npm/keycloak-js@26.2.4/+esm";

const form = document.querySelector("#uploadForm");
const submitButton = document.querySelector("#submitButton");
const submitLabel = document.querySelector("#submitLabel");
const submitLoader = document.querySelector("#submitLoader");
const responseSection = document.querySelector("#response");
const resultId = document.querySelector("#resultId");
const overallStatus = document.querySelector("#overallStatus");
const records = document.querySelector("#records");
const downloadLinks = document.querySelector("#downloadLinks");
const errorBox = document.querySelector("#error");
const userBar = document.querySelector("#userBar");
const userGreeting = document.querySelector("#userGreeting");
const userMenuButton = document.querySelector("#userMenuButton");
const userAvatar = document.querySelector("#userAvatar");
const userDropdown = document.querySelector("#userDropdown");
const logoutButton = document.querySelector("#logoutButton");

let downloadUrls = [];
let keycloak;

setupDropzone("firstFile", "firstFileName");
setupDropzone("secondFile", "secondFileName");
initKeycloak();

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const secondFile = formData.get("secondFile");
    if (secondFile instanceof File && !secondFile.name) formData.delete("secondFile");
    submitButton.disabled = true;
    submitLabel.textContent = "Wysylanie...";
    submitLoader.hidden = false;
    errorBox.hidden = true;
    responseSection.hidden = true;
    revokeDownloadUrls();
    downloadLinks.replaceChildren();

    try {
        await refreshToken();

        const response = await fetch("/api/files/process", {
            method: "POST",
            headers: {
                Accept: "multipart/form-data",
                Authorization: `Bearer ${keycloak.token}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const parts = await response.formData();
        const jsonPart = parts.get("jsonResult");
        if (jsonPart === null) throw new Error("Brak części jsonResult w odpowiedzi.");
        const data = JSON.parse(typeof jsonPart === "string" ? jsonPart : await jsonPart.text());
        if (!data || typeof data.id !== "string" || !["VALID", "INVALID"].includes(data.overallStatus) || !Array.isArray(data.records) || !data.records.every(
            (record) => record && ["id", "status", "subject", "preson"].every((key) => typeof record[key] === "string")
                && Array.isArray(record.warns) && record.warns.every((warning) => typeof warning === "string")
        )) {
            throw new Error("Nieprawidłowa struktura części jsonResult.");
        }
        const firstPdfFile = parts.get("firstPdfFile");
        const outputSecondFile = parts.get("secondFile");
        if (!(firstPdfFile instanceof File) || !firstPdfFile.name || (outputSecondFile !== null && !(outputSecondFile instanceof File))) {
            throw new Error("Nieprawidłowe części plikowe odpowiedzi.");
        }
        renderResult(data);
        prepareDownloads(outputSecondFile ? [firstPdfFile, outputSecondFile] : [firstPdfFile]);
        responseSection.hidden = false;
    } catch (error) {
        errorBox.textContent = `Nie udalo sie wyslac plikow: ${error.message}`;
        errorBox.hidden = false;
    } finally {
        submitButton.disabled = false;
        submitLabel.textContent = "Wyslij";
        submitLoader.hidden = true;
    }
});

window.addEventListener("beforeunload", revokeDownloadUrls);
document.addEventListener("click", closeUserDropdownOnOutsideClick);
userMenuButton.addEventListener("click", toggleUserDropdown);
logoutButton.addEventListener("click", () => keycloak.logout());

async function initKeycloak() {
    setFormEnabled(false);

    keycloak = new Keycloak({
        url: "http://localhost:8085",
        realm: "test",
        clientId: "test-public"
    });

    try {
        await keycloak.init({
            onLoad: "login-required",
            checkLoginIframe: false
        });

        renderAuthenticatedUser();
        setFormEnabled(true);
    } catch (error) {
        showAuthError(`Nie udalo sie zalogowac przez Keycloak: ${error.message ?? error}`);
    }
}

async function refreshToken() {
    try {
        await keycloak.updateToken(30);
    } catch (error) {
        await keycloak.login();
        throw error;
    }
}

function renderAuthenticatedUser() {
    const preferredName =  keycloak.tokenParsed?.name
        ?? keycloak.tokenParsed?.email
        ?? keycloak.tokenParsed?.preferred_username
        ?? "zalogowany uzytkownik";

    userGreeting.innerHTML = `Cześć<br><strong>${preferredName}</strong>`;
    userAvatar.textContent = preferredName.trim().charAt(0).toUpperCase();
    userAvatar.style.backgroundColor = getUserColor(preferredName);
    userBar.hidden = false;
}

function toggleUserDropdown(event) {
    event.stopPropagation();

    const isOpen = userDropdown.hidden;
    userDropdown.hidden = !isOpen;
    userMenuButton.setAttribute("aria-expanded", String(isOpen));
}

function closeUserDropdownOnOutsideClick(event) {
    if (userBar.hidden || userDropdown.hidden || userMenuButton.contains(event.target) || userDropdown.contains(event.target)) {
        return;
    }

    userDropdown.hidden = true;
    userMenuButton.setAttribute("aria-expanded", "false");
}

function getUserColor(name) {
    let hash = 0;

    for (let index = 0; index < name.length; index += 1) {
        hash = ((hash << 5) - hash) + name.charCodeAt(index);
        hash |= 0;
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 82%, 48%)`;
}

function showAuthError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
}

function setFormEnabled(isEnabled) {
    submitButton.disabled = !isEnabled;
    submitLabel.textContent = isEnabled ? "Wyslij" : "Logowanie...";
}

function setupDropzone(inputId, fileNameId) {
    const input = document.querySelector(`#${inputId}`);
    const dropzone = input.closest(".dropzone");
    const fileName = document.querySelector(`#${fileNameId}`);

    input.addEventListener("change", () => {
        updateFileName(input, fileName);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropzone.classList.add("is-dragging");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropzone.classList.remove("is-dragging");
        });
    });

    dropzone.addEventListener("drop", (event) => {
        const files = event.dataTransfer.files;

        if (files.length === 0) {
            return;
        }

        input.files = files;
        updateFileName(input, fileName);
    });
}

function updateFileName(input, fileName) {
    fileName.textContent = input.files.length > 0 ? input.files[0].name : "Nie wybrano pliku";
}

function renderResult(data) {
    resultId.textContent = data.id;
    overallStatus.textContent = data.overallStatus;
    overallStatus.className = data.overallStatus === "VALID" ? "status-valid" : "status-invalid";
    records.replaceChildren();
    for (const [index, record] of data.records.entries()) {
        const item = document.createElement("li");
        const card = document.createElement("article");
        card.className = "record-card";
        card.setAttribute("aria-labelledby", `record-title-${index}`);
        const header = document.createElement("header");
        header.className = "record-header";
        const identity = document.createElement("div");
        identity.className = "record-identity";
        const title = document.createElement("h3");
        title.id = `record-title-${index}`;
        title.textContent = `Rekord ${index + 1}`;
        const id = document.createElement("p");
        id.className = "record-id";
        id.textContent = `ID: ${record.id}`;
        identity.append(title, id);
        const status = document.createElement("span");
        status.className = `record-status ${record.status === "VALID" ? "status-valid" : record.status === "INVALID" ? "status-invalid" : ""}`;
        status.textContent = record.status;
        status.setAttribute("aria-label", `Status: ${record.status}`);
        header.append(identity, status);
        const body = document.createElement("div");
        body.className = "record-body";
        const mainFields = document.createElement("dl");
        mainFields.className = "record-main-fields";
        for (const [key, label] of [["subject", "Przedmiot"], ["preson", "Osoba"]]) {
            const field = document.createElement("div");
            const name = document.createElement("dt");
            const value = document.createElement("dd");
            name.textContent = label;
            value.textContent = record[key] || "—";
            field.append(name, value);
            mainFields.append(field);
        }
        header.append(mainFields);
        if (record.warns.length) {
            const warningSection = document.createElement("section");
            warningSection.className = "record-warnings";
            warningSection.setAttribute("aria-label", `Ostrzeżenia rekordu ${record.id}`);
            const heading = document.createElement("h4");
            heading.textContent = `Ostrzeżenia (${record.warns.length})`;
            const list = document.createElement("ul");
            for (const warning of record.warns) {
                const item = document.createElement("li");
                item.textContent = warning;
                list.append(item);
            }
            warningSection.append(heading, list);
            body.append(warningSection);
        }
        if (record.optinalData && typeof record.optinalData === "object") {
            const additionalData = document.createElement("section");
            additionalData.className = "record-additional-data";
            additionalData.setAttribute("aria-label", `Dodatkowe dane rekordu ${record.id}`);
            const heading = document.createElement("h4");
            heading.textContent = "Dodatkowe dane";
            const fields = document.createElement("dl");
            fields.className = "record-details";
            for (const [key, label] of [["firstName", "Imię"], ["lastName", "Nazwisko"], ["surname", "Nazwisko (surname)"], ["age", "Wiek"], ["city", "Miasto"], ["postalCode", "Kod pocztowy"]]) {
                const field = document.createElement("div");
                const title = document.createElement("dt");
                const value = document.createElement("dd");
                title.textContent = `${label}:`;
                value.textContent = record.optinalData[key] ?? "—";
                field.append(title, value);
                fields.append(field);
            }
            additionalData.append(heading, fields);
            body.append(additionalData);
        }
        card.append(header);
        if (body.hasChildNodes()) card.append(body);
        item.append(card);
        records.append(item);
    }
    if (!data.records.length) {
        const item = document.createElement("li");
        item.className = "record-empty";
        item.textContent = "Brak rekordów.";
        records.append(item);
    }
}

function prepareDownloads(files) {
    for (const file of files) {
        const url = URL.createObjectURL(file);
        downloadUrls.push(url);
        const link = document.createElement("a");
        link.className = "download-link";
        link.href = url;
        link.download = file.name;
        link.textContent = `Pobierz ${file.name}`;
        downloadLinks.append(link);
    }
}

function revokeDownloadUrls() {
    downloadUrls.forEach((url) => URL.revokeObjectURL(url));
    downloadUrls = [];
}
