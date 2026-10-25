import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-user-menu',
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeOnOutsideClick($event)',
    '(document:keydown.escape)': 'isOpen.set(false)',
  },
})
export class UserMenu {
  readonly displayName = input.required<string>();
  readonly logoutRequested = output<void>();
  protected readonly isOpen = signal(false);
  protected readonly initial = computed(() => this.displayName().trim().charAt(0).toUpperCase());
  protected readonly avatarHue = computed(() => {
    let hash = 0;
    for (const character of this.displayName()) {
      hash = (hash << 5) - hash + character.charCodeAt(0);
      hash |= 0;
    }
    return Math.abs(hash) % 360;
  });
  private readonly element = inject(ElementRef<HTMLElement>);

  protected toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen.update((value) => !value);
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.isOpen.set(false);
  }
}
