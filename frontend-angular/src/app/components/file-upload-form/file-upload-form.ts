import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { APP_SETTINGS } from '../../config/app-settings';
import { FilePair } from '../../models/file-pair';
import { FileDropzone } from '../file-dropzone/file-dropzone';

@Component({
  selector: 'app-file-upload-form',
  imports: [FileDropzone],
  templateUrl: './file-upload-form.html',
  styleUrl: './file-upload-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUploadForm {
  readonly authenticated = input(false);
  readonly submitting = input(false);
  readonly filesSubmitted = output<FilePair>();
  readonly filesCleared = output<void>();
  readonly selectionChanged = output<void>();
  readonly validationFailed = output<string>();
  protected readonly settings = inject(APP_SETTINGS);
  protected readonly firstFile = signal<File | null>(null);
  protected readonly secondFile = signal<File | null>(null);

  protected setFile(slot: keyof FilePair, file: File | null): void {
    if (this.submitting()) return;
    this.selectionChanged.emit();
    const error = file ? this.validateFile(slot, file) : null;
    (slot === 'firstFile' ? this.firstFile : this.secondFile).set(error ? null : file);
    if (error) this.validationFailed.emit(error);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (!this.authenticated() || this.submitting()) return;
    const firstFile = this.firstFile();
    const secondFile = this.secondFile();
    if (!firstFile) {
      this.validationFailed.emit('Wybierz pierwszy plik przed wysłaniem.');
      return;
    }
    const error =
      this.validateFile('firstFile', firstFile) ??
      (secondFile ? this.validateFile('secondFile', secondFile) : null);
    if (error) {
      this.validationFailed.emit(error);
      return;
    }
    this.filesSubmitted.emit({ firstFile, secondFile });
  }

  protected requestClearFiles(dialog: HTMLDialogElement): void {
    if (this.submitting() || (!this.firstFile() && !this.secondFile())) return;
    dialog.showModal();
  }

  protected clearFiles(dialog: HTMLDialogElement): void {
    if (this.submitting() || (!this.firstFile() && !this.secondFile())) {
      dialog.close();
      return;
    }
    this.firstFile.set(null);
    this.secondFile.set(null);
    this.filesCleared.emit();
    dialog.close();
  }

  private validateFile(slot: keyof FilePair, file: File): string | null {
    const extensions = this.settings.fileExtensions[slot];
    if (
      !extensions.length ||
      extensions.some((extension) => file.name.toLowerCase().endsWith(extension))
    ) {
      return null;
    }
    const label = slot === 'firstFile' ? 'Pierwszy plik' : 'Drugi plik';
    return `${label}: niedozwolone rozszerzenie pliku „${file.name}”. Dozwolone: ${extensions.join(', ')}.`;
  }
}
