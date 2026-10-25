import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FileProcessingResponse } from '../../models/file-processing-response';

@Component({
  selector: 'app-processing-result',
  templateUrl: './processing-result.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessingResult {
  readonly response = input.required<FileProcessingResponse>();
  readonly pdfDownloadUrl = input<string | null>(null);
}
