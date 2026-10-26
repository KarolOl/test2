import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/file-processing/file-processing').then((m) => m.FileProcessingPage),
  },
  { path: '**', redirectTo: '' },
];
