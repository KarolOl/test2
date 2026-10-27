import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FileProcessingResponse, ProcessingJsonResult } from '../models/file-processing-response';
import { APP_SETTINGS } from '../config/app-settings';

@Injectable({ providedIn: 'root' })
export class FileProcessingService {
  private readonly settings = inject(APP_SETTINGS);
  constructor(private readonly http: HttpClient) {}

  async process(firstFile: File, secondFile: File | null): Promise<FileProcessingResponse> {
    const payload = new FormData();
    payload.append('firstFile', firstFile);
    if (secondFile) {
      payload.append('secondFile', secondFile);
    }

    const response = await firstValueFrom(
      this.http.post(`${this.settings.apiBaseUrl}/files/process`, payload, {
        observe: 'response',
        responseType: 'blob',
        headers: { Accept: 'multipart/form-data' },
      }),
    );
    const contentType = response.headers.get('Content-Type') ?? '';
    if (!response.body || !/^multipart\/form-data\s*;/i.test(contentType)) {
      throw new Error('Oczekiwano odpowiedzi multipart/form-data z plikami i wynikiem JSON.');
    }

    let parts: FormData;
    try {
      parts = await new Response(response.body, {
        headers: { 'Content-Type': contentType },
      }).formData();
    } catch {
      throw new Error('Nie udało się odczytać części odpowiedzi multipart.');
    }

    const firstPdfFile = this.readFilePart(parts, 'firstPdfFile');
    const secondFilePart = parts.has('secondFile') ? this.readFilePart(parts, 'secondFile') : null;
    const jsonPart = parts.get('jsonResult');
    if (jsonPart === null || parts.getAll('jsonResult').length !== 1) {
      throw new Error('Odpowiedź musi zawierać dokładnie jedną część jsonResult.');
    }

    let jsonResult: unknown;
    try {
      jsonResult = JSON.parse(typeof jsonPart === 'string' ? jsonPart : await jsonPart.text());
    } catch {
      throw new Error('Część jsonResult nie zawiera prawidłowego JSON.');
    }
    if (!isProcessingJsonResult(jsonResult)) {
      throw new Error('Część jsonResult ma nieprawidłową strukturę.');
    }

    return { firstPdfFile, secondFile: secondFilePart, jsonResult };
  }

  private readFilePart(parts: FormData, name: string): File {
    const part = parts.get(name);
    if (!(part instanceof File) || !part.name || parts.getAll(name).length !== 1) {
      throw new Error(`Odpowiedź musi zawierać jedną część plikową ${name} z nazwą pliku.`);
    }
    return part;
  }
}

function isProcessingJsonResult(value: unknown): value is ProcessingJsonResult {
  if (!isObject(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    (value['overallStatus'] === 'VALID' || value['overallStatus'] === 'INVALID') &&
    Array.isArray(value['records']) &&
    value['records'].every(
      (record: unknown) =>
        isObject(record) &&
        ['id', 'status', 'subject', 'preson'].every((key) => typeof record[key] === 'string') &&
        Array.isArray(record['warns']) &&
        record['warns'].every((warning: unknown) => typeof warning === 'string') &&
        isOptionalData(record['optinalData']),
    )
  );
}

function isOptionalData(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return (
    isObject(value) &&
    ['firstName', 'lastName', 'surname', 'city', 'postalCode'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    typeof value['age'] === 'number' &&
    Number.isInteger(value['age']) &&
    value['age'] >= 0
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
