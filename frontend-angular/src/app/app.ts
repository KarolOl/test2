import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { APP_SETTINGS } from './config/app-settings';
import { FileProcessingResponse } from './models/file-processing-response';
import { AuthenticationService } from './services/authentication.service';
import { LoadingService } from './services/loading.service';
import { FileProcessingService } from './services/file-processing.service';

import { FilePair } from './models/file-pair';
import { UserMenu } from './components/user-menu/user-menu';
import { FileUploadForm } from './components/file-upload-form/file-upload-form';
import { ProcessingResult } from './components/processing-result/processing-result';
import { LoadingSpinner } from './components/loading-spinner/loading-spinner';

@Component({
  selector: 'app-root',
  imports: [UserMenu, FileUploadForm, ProcessingResult, LoadingSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  protected readonly settings = inject(APP_SETTINGS);
  protected readonly isInitializing = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly userName = signal('');
  protected readonly result = signal<FileProcessingResponse | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly pdfDownloadUrl = signal<string | null>(null);

  constructor(
    protected readonly authentication: AuthenticationService,
    private readonly fileProcessing: FileProcessingService,
    protected readonly loading: LoadingService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const user = await this.authentication.initialize();
      this.userName.set(user.displayName);
    } catch (error) {
      this.errorMessage.set(
        `Nie udało się zalogować przez Keycloak: ${this.getErrorMessage(error)}`,
      );
    } finally {
      this.isInitializing.set(false);
    }
  }

  ngOnDestroy(): void {
    this.revokePdfUrl();
  }

  protected async submit({ firstFile, secondFile }: FilePair): Promise<void> {
    if (!this.authentication.isAuthenticated() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.clearResponse();

    try {
      const token = await this.authentication.getValidToken();
      const response = await this.fileProcessing.process(firstFile, secondFile, token);
      this.result.set(response);
      this.createPdfDownload(response.pdfFileInBase64);
    } catch (error) {
      this.errorMessage.set(`Nie udało się wysłać plików: ${this.getErrorMessage(error)}`);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected clearResponse(): void {
    this.result.set(null);
    this.errorMessage.set('');
    this.revokePdfUrl();
  }

  protected logout(): void {
    void this.authentication.logout();
  }

  private createPdfDownload(base64Value: string | null | undefined): void {
    if (!base64Value) {
      return;
    }

    try {
      const binary = atob(base64Value);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      this.pdfDownloadUrl.set(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })));
    } catch {
      this.errorMessage.set('Odpowiedź zawiera nieprawidłowe dane PDF w formacie Base64.');
    }
  }

  private revokePdfUrl(): void {
    const url = this.pdfDownloadUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.pdfDownloadUrl.set(null);
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
