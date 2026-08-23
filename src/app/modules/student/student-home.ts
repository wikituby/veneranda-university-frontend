import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { CourseService } from '../../core/services/course.service';
import { CourseCategory, CourseEnrollment } from '../../core/models/course.model';
import { coverTheme, programmeCategory, PROGRAMME_CATEGORIES, DEFAULT_INSTITUTION, AFFILIATED_INSTITUTIONS, programmeHeading } from '../../core/utils/programme.util';
import { CatalogueTopbar } from '../../layout/catalogue-topbar/catalogue-topbar';

@Component({
  selector: 'app-student-home',
  standalone: true,
  imports: [CommonModule, RouterLink, CatalogueTopbar],
  templateUrl: './student-home.html',
  styleUrl: './student-home.scss',
})
export class StudentHome implements OnInit {
  private auth = inject(AuthService);
  private courses = inject(CourseService);
  private router = inject(Router);

  readonly coverTheme = coverTheme;
  readonly programmeCategory = programmeCategory;
  readonly programmeHeading = programmeHeading;
  readonly defaultInstitution = DEFAULT_INSTITUTION;
  readonly institutions = AFFILIATED_INSTITUTIONS;

  loading = signal(true);
  error = signal('');
  enrollments = signal<CourseEnrollment[]>([]);
  programmes = signal<CourseCategory[]>([]);
  joiningId = signal<string | null>(null);
  unjoining = signal(false);
  unjoinStep = signal<'warn' | 'password' | null>(null);
  unjoinTarget = signal<{ id: string; title: string } | null>(null);
  unjoinPassword = signal('');
  unjoinError = signal('');
  hideUnjoinPassword = signal(true);
  editing = signal<CourseCategory | null>(null);
  deleting = signal<CourseCategory | null>(null);
  formTitle = signal('');
  formDescription = signal('');
  formProgrammeCode = signal('');
  formAbbreviation = signal('');
  formInstitution = signal<string>(DEFAULT_INSTITUTION);
  formCoverImageUrl = signal('');
  formCoverError = signal('');
  coverDirty = signal(false);
  coverUploadBusy = signal(false);
  formBusy = signal(false);
  deleteBusy = signal(false);
  failedCovers = signal(new Set<string>());
  yoursOpen = signal(true);
  exploreOpen = signal(true);
  searchQuery = signal('');
  selectedCategory = signal('All');

  readonly joinedIds = computed(() => new Set(this.enrollments().map((e) => e.categoryId)));

  readonly availableProgrammes = computed(() => {
    const joined = this.joinedIds();
    return this.programmes().filter((p) => !joined.has(p.id));
  });

  readonly programmeFilters = computed(() => {
    const present = new Set(this.availableProgrammes().map((p) => programmeCategory(p.title)));
    return ['All', ...PROGRAMME_CATEGORIES.filter((cat) => present.has(cat))];
  });

  readonly exploreProgrammes = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();
    return this.availableProgrammes().filter((p) => {
      if (cat !== 'All' && programmeCategory(p.title) !== cat) return false;
      if (!q) return true;
      const haystack = `${p.title} ${p.abbreviation || ''} ${p.programmeCode || ''} ${p.description || ''} ${p.affiliatedInstitution || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  });

  get userName(): string {
    const u = this.auth.currentUser;
    if (!u) return 'there';
    return (u.fullName || '').trim() || u.username || 'there';
  }

  institutionOf(categoryId: string): string {
    return this.programmes().find((p) => p.id === categoryId)?.affiliatedInstitution || this.defaultInstitution;
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set('');
    this.courses.getCategories(true).subscribe({
      next: (categories) => {
        this.programmes.set((categories || []).filter((c) => !c.parentId && (c.nodeKind || 'PROGRAMME') === 'PROGRAMME'));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load programmes. Retry in a moment.');
        this.loading.set(false);
      },
    });
    this.courses.listMyEnrollments().pipe(catchError(() => of([] as CourseEnrollment[]))).subscribe({
      next: (enrollments) => {
        this.enrollments.set((enrollments || []).filter((e) => e.enrolled));
      },
    });
  }

  openProgramme(id: string, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/programmes', id]);
  }

  openDetails(p: CourseCategory): void {
    this.router.navigate(['/programmes', p.id, 'details']);
  }

  openDetailsById(id: string): void {
    this.router.navigate(['/programmes', id, 'details']);
  }

  programmeById(id: string): CourseCategory | undefined {
    return this.programmes().find((p) => p.id === id);
  }

  canManageProgramme(p: CourseCategory): boolean {
    return this.auth.canManageProgramme(p.createdBy);
  }

  joinProgramme(p: CourseCategory, event?: Event): void {
    event?.stopPropagation();
    if (this.joinedIds().has(p.id) || this.joiningId() === p.id) {
      this.openProgramme(p.id);
      return;
    }
    this.joiningId.set(p.id);
    this.error.set('');
    this.courses.enroll(p.id).subscribe({
      next: () => {
        this.joiningId.set(null);
        this.enrollments.update((list) => [
          ...list,
          {
            categoryId: p.id,
            categoryTitle: p.title,
            enrollmentStatus: 'ENROLLED',
            groupSyncStatus: 'PENDING',
            enrolled: true,
          },
        ]);
      },
      error: () => {
        this.joiningId.set(null);
        this.error.set('Could not join this programme.');
      },
    });
  }

  showCover(id: string): boolean {
    return !this.failedCovers().has(id);
  }

  onCoverError(id: string): void {
    this.failedCovers.update((prev) => new Set(prev).add(id));
  }

  toggleYours(): void {
    this.yoursOpen.update((open) => !open);
  }

  toggleExplore(): void {
    this.exploreOpen.update((open) => !open);
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  setCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  startUnjoin(item: CourseEnrollment, event: Event): void {
    event.stopPropagation();
    this.unjoinTarget.set({ id: item.categoryId, title: item.categoryTitle || 'this programme' });
    this.unjoinPassword.set('');
    this.unjoinError.set('');
    this.hideUnjoinPassword.set(true);
    this.unjoinStep.set('warn');
  }

  cancelUnjoin(): void {
    if (this.unjoining()) return;
    this.unjoinStep.set(null);
    this.unjoinTarget.set(null);
    this.unjoinPassword.set('');
    this.unjoinError.set('');
  }

  continueUnjoin(): void {
    this.unjoinError.set('');
    this.unjoinPassword.set('');
    this.unjoinStep.set('password');
  }

  onUnjoinPassword(event: Event): void {
    this.unjoinPassword.set((event.target as HTMLInputElement).value);
  }

  confirmUnjoin(): void {
    const target = this.unjoinTarget();
    const password = this.unjoinPassword().trim();
    if (!target || this.unjoining()) return;
    if (!password) {
      this.unjoinError.set('Enter your password to confirm.');
      return;
    }
    this.unjoining.set(true);
    this.unjoinError.set('');
    this.courses.unenroll(target.id, password).subscribe({
      next: () => {
        this.enrollments.update((list) => list.filter((e) => e.categoryId !== target.id));
        this.unjoining.set(false);
        this.cancelUnjoin();
      },
      error: (err) => {
        this.unjoining.set(false);
        this.unjoinError.set(err?.error?.message || 'Could not unjoin this programme.');
      },
    });
  }

  startEdit(p: CourseCategory, event: Event): void {
    event.stopPropagation();
    this.editing.set(p);
    this.formTitle.set(p.title);
    this.formDescription.set(p.description || '');
    this.formProgrammeCode.set(p.programmeCode || '');
    this.formAbbreviation.set(p.abbreviation || '');
    this.formInstitution.set(p.affiliatedInstitution || this.defaultInstitution);
    this.formCoverImageUrl.set(p.coverImageUrl || '');
    this.formCoverError.set('');
    this.coverDirty.set(false);
    this.coverUploadBusy.set(false);
    this.error.set('');
  }

  cancelEdit(): void {
    if (this.formBusy()) return;
    this.editing.set(null);
  }

  onFormTitle(event: Event): void {
    this.formTitle.set((event.target as HTMLInputElement).value);
  }

  onFormDescription(event: Event): void {
    this.formDescription.set((event.target as HTMLTextAreaElement).value);
  }

  onFormInstitution(event: Event): void {
    this.formInstitution.set((event.target as HTMLSelectElement).value);
  }

  onFormProgrammeCode(event: Event): void {
    this.formProgrammeCode.set((event.target as HTMLInputElement).value);
  }

  onFormAbbreviation(event: Event): void {
    this.formAbbreviation.set((event.target as HTMLInputElement).value);
  }

  onFormCoverUrl(event: Event): void {
    this.formCoverImageUrl.set((event.target as HTMLInputElement).value);
    this.formCoverError.set('');
    this.coverDirty.set(true);
  }

  clearCoverImage(): void {
    this.formCoverImageUrl.set('');
    this.formCoverError.set('');
    this.coverDirty.set(true);
  }

  onCoverFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const draft = this.editing();
    if (!file || !draft) return;
    if (!file.type.startsWith('image/')) {
      this.formCoverError.set('Choose an image file (JPG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > 5_000_000) {
      this.formCoverError.set('Image must be under 5 MB.');
      return;
    }
    this.coverUploadBusy.set(true);
    this.formCoverError.set('');
    this.courses.uploadCoverImage(draft.id, file).subscribe({
      next: (updated) => {
        this.formCoverImageUrl.set(updated.coverImageUrl || '');
        this.coverDirty.set(false);
        this.coverUploadBusy.set(false);
        this.programmes.update((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        this.failedCovers.update((set) => {
          const next = new Set(set);
          next.delete(updated.id);
          return next;
        });
      },
      error: (err) => {
        this.coverUploadBusy.set(false);
        this.formCoverError.set(err?.error?.message || 'Could not upload cover image. Check that file storage is configured.');
      },
    });
  }

  institutionOptions(): string[] {
    const current = this.formInstitution();
    if (current && !(this.institutions as readonly string[]).includes(current)) {
      return [current, ...this.institutions];
    }
    return [...this.institutions];
  }

  confirmEdit(): void {
    const draft = this.editing();
    const title = this.formTitle().trim();
    if (!draft || !title || this.formBusy()) return;
    this.formBusy.set(true);
    this.error.set('');
    const patch: Partial<CourseCategory> = {
      title,
      description: this.formDescription().trim(),
      programmeCode: this.formProgrammeCode().trim() || null,
      abbreviation: this.formAbbreviation().trim() || null,
      affiliatedInstitution: this.formInstitution(),
    };
    if (this.coverDirty()) {
      patch.coverImageUrl = this.formCoverImageUrl().trim();
    }
    this.courses.updateCategory(draft.id, patch).subscribe({
      next: (updated) => {
        this.programmes.update((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        this.failedCovers.update((set) => {
          const next = new Set(set);
          next.delete(updated.id);
          return next;
        });
        this.formBusy.set(false);
        this.editing.set(null);
      },
      error: (err) => {
        this.formBusy.set(false);
        this.error.set(err?.error?.message || 'Could not save this programme.');
      },
    });
  }

  startDelete(p: CourseCategory, event: Event): void {
    event.stopPropagation();
    this.deleting.set(p);
  }

  cancelDelete(): void {
    if (this.deleteBusy()) return;
    this.deleting.set(null);
  }

  confirmDelete(): void {
    const draft = this.deleting();
    if (!draft || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.error.set('');
    this.courses.deleteCategory(draft.id).subscribe({
      next: () => {
        this.programmes.update((list) => list.filter((p) => p.id !== draft.id));
        this.enrollments.update((list) => list.filter((e) => e.categoryId !== draft.id));
        this.deleteBusy.set(false);
        this.deleting.set(null);
      },
      error: (err) => {
        this.deleteBusy.set(false);
        this.error.set(err?.error?.message || 'Could not delete this programme.');
      },
    });
  }
}
