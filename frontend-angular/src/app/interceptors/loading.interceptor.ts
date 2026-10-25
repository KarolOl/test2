import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  const loading = inject(LoadingService);

  // Count subscriptions, including retries, and release on completion, error or cancellation.
  return defer(() => {
    loading.requestStarted();
    return defer(() => next(request)).pipe(finalize(() => loading.requestFinished()));
  });
};
