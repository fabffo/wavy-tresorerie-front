import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

@Directive({
  selector: 'details[wavyFermetureMenuRoles]',
  host: { '(toggle)': 'actualiserEcoute()' },
})
export class FermetureMenuRolesDirective {
  private readonly menu = inject<ElementRef<HTMLDetailsElement>>(ElementRef).nativeElement;
  private ecoute?: AbortController;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.ecoute?.abort());
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
