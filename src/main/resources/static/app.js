const form = document.querySelector("#uploadForm");
const submitButton = document.querySelector("#submitButton");
const submitLabel = document.querySelector("#submitLabel");
const submitLoader = document.querySelector("#submitLoader");
const responseSection = document.querySelector("#response");
const resultValue = document.querySelector("#resultValue");
const base64Value = document.querySelector("#base64Value");
const downloadPdfLink = document.querySelector("#downloadPdfLink");
const errorBox = document.querySelector("#error");

let pdfObjectUrl;

setupDropzone("firstFile", "firstFileName");
setupDropzone("secondFile", "secondFileName");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    submitButton.disabled = true;
    submitLabel.textContent = "Wysylanie...";
    submitLoader.hidden = false;
    errorBox.hidden = true;
    responseSection.hidden = true;
    downloadPdfLink.hidden = true;
    revokePdfObjectUrl();

    try {
        const response = await fetch("/api/files/process", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        resultValue.textContent = data.result ?? "";
        base64Value.value = data.pdfFileInBase64 ?? "";
        preparePdfDownload(data.pdfFileInBase64);
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

window.addEventListener("beforeunload", revokePdfObjectUrl);

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

function preparePdfDownload(base64Value) {
    if (!base64Value) {
        return;
    }

    const pdfBytes = base64ToUint8Array(base64Value);
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    pdfObjectUrl = URL.createObjectURL(pdfBlob);

    downloadPdfLink.href = pdfObjectUrl;
    downloadPdfLink.hidden = false;
}

function base64ToUint8Array(base64Value) {
    const binary = atob(base64Value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function revokePdfObjectUrl() {
    if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
        pdfObjectUrl = undefined;
    }
}
