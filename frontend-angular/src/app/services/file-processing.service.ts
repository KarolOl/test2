import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FileProcessingResponse } from '../models/file-processing-response';
import { APP_SETTINGS } from '../config/app-settings';

@Injectable({ providedIn: 'root' })
export class FileProcessingService {
  private readonly settings = inject(APP_SETTINGS);
  constructor(private readonly http: HttpClient) {}

  process(
    firstFile: File,
    secondFile: File | null,
    token: string,
  ): Promise<FileProcessingResponse> {
    const payload = new FormData();
    payload.append('firstFile', firstFile);
    if (secondFile) {
      payload.append('secondFile', secondFile);
    }

    return firstValueFrom(
      this.http.post<FileProcessingResponse>(`${this.settings.apiBaseUrl}/files/process`, payload, {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
      }),
    );
  }
}
