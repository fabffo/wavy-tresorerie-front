import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

@Directive({
  selector: 'details[wavyFermetureMenuRoles]',
  host: { '(toggle)': 'actualiserEcoute()', '(focusout)': 'verifierSortieDuFocus()' },
})
export class FermetureMenuRolesDirective {
  private readonly menu = inject<ElementRef<HTMLDetailsElement>>(ElementRef).nativeElement;
  private ecoute?: AbortController;
  private verificationFocus?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.ecoute?.abort();
      clearTimeout(this.verificationFocus);
    });
  }

  verifierSortieDuFocus(): void {
    clearTimeout(this.verificationFocus);
    if (!this.menu.open) return;

    this.verificationFocus = setTimeout(() => {
      if (this.menu.open && !this.menu.contains(this.menu.ownerDocument.activeElement)) {
        this.menu.open = false;
      }
    }, 0);
  }

  actualiserEcoute(): void {
    this.ecoute?.abort();
    this.ecoute = undefined;
    if (!this.menu.open) return;

    this.ecoute = new AbortController();
    this.menu.ownerDocument.addEventListener('pointerdown', event => {
      if (!event.composedPath().includes(this.menu)) this.menu.open = false;
    }, { capture: true, signal: this.ecoute.signal });
  }
}
