import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { FileProcessingResponse } from '../../models/file-processing-response';

@Component({
  selector: 'app-processing-result',
  templateUrl: './processing-result.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessingResult {
  readonly response = input.required<FileProcessingResponse>();
  protected readonly downloads = signal<{ name: string; url: string }[]>([]);

  constructor() {
    effect((onCleanup) => {
      const { firstPdfFile, secondFile } = this.response();
      const files = secondFile ? [firstPdfFile, secondFile] : [firstPdfFile];
      const downloads = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
      this.downloads.set(downloads);
      onCleanup(() => downloads.forEach(({ url }) => URL.revokeObjectURL(url)));
    });
  }
}
