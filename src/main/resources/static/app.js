import Keycloak from "https://cdn.jsdelivr.net/npm/keycloak-js@26.2.4/+esm";

const form = document.querySelector("#uploadForm");
const submitButton = document.querySelector("#submitButton");
const submitLabel = document.querySelector("#submitLabel");
const submitLoader = document.querySelector("#submitLoader");
const responseSection = document.querySelector("#response");
const resultId = document.querySelector("#resultId");
const overallStatus = document.querySelector("#overallStatus");
const warnings = document.querySelector("#warnings");
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
        if (!data || typeof data.id !== "string" || !["VALID", "INVALID"].includes(data.overallStatus) || !Array.isArray(data.warns) || !Array.isArray(data.records)) {
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
    warnings.replaceChildren();
    for (const warning of data.warns) {
        const item = document.createElement("li");
        item.textContent = warning;
        warnings.append(item);
    }
    records.replaceChildren();
    for (const record of data.records) {
        const row = document.createElement("tr");
        for (const key of ["id", "status", "subject", "preson"]) {
            const cell = document.createElement("td");
            cell.textContent = record[key] || "—";
            row.append(cell);
        }
        records.append(row);
    }
    if (!data.records.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.textContent = "Brak rekordów.";
        row.append(cell);
        records.append(row);
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
