import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DEFAULT_INSTITUTION,
  allAffiliatedInstitutions,
  rememberAffiliatedInstitution,
} from '../../core/utils/programme.util';

@Component({
  selector: 'app-institution-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './institution-picker.html',
  styleUrl: './institution-picker.scss',
})
export class InstitutionPicker implements OnDestroy {
  private renderer = inject(Renderer2);

  /** Two-way bound selected institution name. */
  value = model<string>(DEFAULT_INSTITUTION);
  placeholder = input('Select affiliated university');
  label = input('Institution affiliated to');

  open = signal(false);
  query = signal('');
  adding = signal(false);
  draftName = signal('');
  addError = signal('');

  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private addInput = viewChild<ElementRef<HTMLInputElement>>('addInput');
  private overlayHost = viewChild<ElementRef<HTMLElement>>('overlayHost');

  /** Refresh when a custom school is added. */
  private listVersion = signal(0);
  private bodyLockClass = 'inst-picker-open';

  options = computed(() => {
    this.listVersion();
    return allAffiliatedInstitutions(this.value());
  });

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.options();
    if (!q) return list;
    return list.filter((item) => item.toLowerCase().includes(q));
  });

  displayValue = computed(() => this.value()?.trim() || this.placeholder());

  constructor() {
    effect(() => {
      const overlay = this.overlayHost()?.nativeElement;
      if (!overlay) return;
      // Keep the popup above any parent modal overflow/transform.
      if (overlay.parentElement !== document.body) {
        this.renderer.appendChild(document.body, overlay);
      }
    });

    effect(() => {
      if (this.open()) {
        document.body.classList.add(this.bodyLockClass);
      } else {
        document.body.classList.remove(this.bodyLockClass);
      }
    });
  }

  ngOnDestroy(): void {
    document.body.classList.remove(this.bodyLockClass);
    const overlay = this.overlayHost()?.nativeElement;
    overlay?.remove();
  }

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.openPicker();
  }

  openPicker(): void {
    this.open.set(true);
    this.adding.set(false);
    this.query.set('');
    this.draftName.set('');
    this.addError.set('');
    setTimeout(() => this.searchInput()?.nativeElement.focus(), 0);
  }

  close(): void {
    this.open.set(false);
    this.adding.set(false);
    this.query.set('');
    this.draftName.set('');
    this.addError.set('');
  }

  select(name: string): void {
    this.value.set(name);
    this.close();
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  startAdd(): void {
    this.adding.set(true);
    this.addError.set('');
    const seed = this.query().trim();
    this.draftName.set(seed);
    setTimeout(() => this.addInput()?.nativeElement.focus(), 0);
  }

  cancelAdd(): void {
    this.adding.set(false);
    this.draftName.set('');
    this.addError.set('');
    setTimeout(() => this.searchInput()?.nativeElement.focus(), 0);
  }

  onDraft(event: Event): void {
    this.draftName.set((event.target as HTMLInputElement).value);
    this.addError.set('');
  }

  confirmAdd(): void {
    const name = this.draftName().trim();
    if (!name) {
      this.addError.set('Enter a university or college name.');
      return;
    }
    if (name.length < 2) {
      this.addError.set('Name is too short.');
      return;
    }
    const saved = rememberAffiliatedInstitution(name);
    this.listVersion.update((n) => n + 1);
    this.select(saved);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }
}
