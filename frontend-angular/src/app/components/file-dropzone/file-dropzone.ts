import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-file-dropzone',
  templateUrl: './file-dropzone.html',
  styleUrl: './file-dropzone.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileDropzone {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly required = input(false);
  readonly file = input<File | null>(null);
  readonly disabled = input(false);
  readonly allowedExtensions = input<readonly string[]>([]);
  readonly fileSelected = output<File | null>();
  protected readonly isDragging = signal(false);
  protected readonly accept = computed(() => this.allowedExtensions().join(','));
  protected readonly fileType = computed(() => {
    const name = this.file()?.name ?? '';
    const separator = name.lastIndexOf('.');
    return separator > 0 && separator < name.length - 1
      ? name.slice(separator + 1).toUpperCase()
      : 'Plik';
  });
  protected readonly fileSize = computed(() => {
    const size = this.file()?.size ?? 0;
    const format = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });
    if (size < 1024) return `${format.format(size)} B`;
    if (size < 1024 * 1024) return `${format.format(size / 1024)} KB`;
    return `${format.format(size / (1024 * 1024))} MB`;
  });

  protected selectFile(event: Event): void {
    if (this.disabled()) return;
    const input = event.target as HTMLInputElement;
    this.fileSelected.emit(input.files?.item(0) ?? null);
    input.value = '';
  }

  protected dragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.isDragging.set(true);
  }

  protected dragLeave(event: DragEvent): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !target.contains(event.relatedTarget)) {
      this.isDragging.set(false);
    }
  }

  protected dropFile(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (!this.disabled()) this.fileSelected.emit(event.dataTransfer?.files.item(0) ?? null);
  }
}
