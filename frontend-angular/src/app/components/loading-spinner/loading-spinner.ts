import {
  afterRenderEffect,
  inject,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-loading-spinner',
  imports: [NgxSpinnerModule],
  template: `
    <ngx-spinner
      name="app-loading"
      type="square-spin"
      size="medium"
      color="var(--bs-primary)"
      bdColor="var(--app-spinner-overlay)"
      [fullScreen]="true"
    >
      <p class="text-body fw-semibold" role="status" aria-live="polite">{{ message() }}</p>
    </ngx-spinner>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingSpinner {
  private readonly spinner = inject(NgxSpinnerService);
  readonly active = input(false);
  readonly message = input('Ładowanie...');

  constructor() {
    afterRenderEffect(() => {
      if (this.active()) {
        void this.spinner.show('app-loading');
      } else {
        void this.spinner.hide('app-loading');
      }
    });
  }
}
