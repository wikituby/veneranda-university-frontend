import { Component, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { CourseService } from '../../core/services/course.service';
import { CourseCategory, CourseEnrollment } from '../../core/models/course.model';
import { coverTheme, programmeCategory, DEFAULT_INSTITUTION, programmeHeading, programmeCoverUrl } from '../../core/utils/programme.util';
import { CatalogueTopbar } from '../../layout/catalogue-topbar/catalogue-topbar';
import { InstitutionPicker } from '../../shared/institution-picker/institution-picker';

@Component({
  selector: 'app-student-home',
  standalone: true,
  imports: [CommonModule, RouterLink, CatalogueTopbar, InstitutionPicker],
  templateUrl: './student-home.html',
  styleUrl: './student-home.scss',
})
export class StudentHome implements OnInit {
  private auth = inject(AuthService);
  private courses = inject(CourseService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);

  readonly coverTheme = coverTheme;
  readonly programmeCoverUrl = programmeCoverUrl;
  readonly programmeCategory = programmeCategory;
  readonly programmeHeading = programmeHeading;
  readonly defaultInstitution = DEFAULT_INSTITUTION;

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
  createdOpen = signal(true);
  exploreOpen = signal(true);
  searchQuery = signal('');
  selectedCategory = signal('All');

  readonly joinedIds = computed(() => new Set(this.enrollments().map((e) => e.categoryId)));

  readonly createdProgrammes = computed(() =>
    this.programmes().filter((p) => this.isCreatedByYou(p)),
  );

  /** Explore lists all published programmes, including ones already joined. */
  readonly availableProgrammes = computed(() => this.programmes());

  readonly programmeFilters = computed(() => ['All', 'Diploma', 'Degree'] as const);

  readonly exploreUniversities = computed(() => {
    const names = new Set(
      this.availableProgrammes()
        .map((p) => (p.affiliatedInstitution || '').trim())
        .filter(Boolean),
    );
    return ['All universities', ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  });

  selectedUniversity = signal('All universities');
  uniMenuOpen = signal(false);
  uniQuery = signal('');

  readonly filteredUniversities = computed(() => {
    const q = this.uniQuery().trim().toLowerCase();
    const list = this.exploreUniversities();
    if (!q) return list;
    return list.filter((uni) => uni.toLowerCase().includes(q));
  });

  readonly universityFilterActive = computed(
    () => this.selectedUniversity() !== 'All universities',
  );

  readonly exploreProgrammes = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();
    const uni = this.selectedUniversity();
    return this.availableProgrammes().filter((p) => {
      if (cat !== 'All') {
        const kind = programmeCategory(p.title);
        if (cat === 'Diploma' && kind !== 'Diploma') return false;
        if (cat === 'Degree' && !['Bachelor', 'Masters', 'Doctorate'].includes(kind)) return false;
      }
      if (uni && uni !== 'All universities') {
        const inst = (p.affiliatedInstitution || '').trim();
        if (inst.toLowerCase() !== uni.toLowerCase()) return false;
      }
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
    this.failedCovers.set(new Set());
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

  private refreshProgrammeCover(programmeId: string, closeEdit = false): void {
    this.courses.getCategories(true).subscribe({
      next: (categories) => {
        this.programmes.set((categories || []).filter((c) => !c.parentId && (c.nodeKind || 'PROGRAMME') === 'PROGRAMME'));
        this.failedCovers.update((set) => {
          const next = new Set(set);
          next.delete(programmeId);
          return next;
        });
        if (closeEdit) {
          this.editing.set(null);
          this.formBusy.set(false);
          this.coverUploadBusy.set(false);
        }
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

  /** True when the signed-in user is the programme creator (not just staff). */
  isCreatedByYou(p?: CourseCategory | null): boolean {
    if (!p?.createdBy) return false;
    const userId = this.auth.currentUser?.id;
    return userId != null && p.createdBy === userId;
  }

  creatorName(p?: CourseCategory | null): string {
    if (!p) return '';
    if (this.isCreatedByYou(p)) {
      const u = this.auth.currentUser;
      return (u?.fullName || '').trim() || u?.username || 'You';
    }
    return (p.createdByName || '').trim() || 'Programme coordinator';
  }

  creatorAvatarUrl(p?: CourseCategory | null): string | null {
    if (!p) return null;
    return (p.createdByAvatarUrl || '').trim() || null;
  }

  creatorInitials(p?: CourseCategory | null): string {
    const name = this.creatorName(p);
    const parts = name.split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  joinLabel(p: CourseCategory): string {
    if (this.joinedIds().has(p.id)) return 'Joined';
    return (p.joinMode || 'OPEN').toUpperCase() === 'REQUEST' ? 'Request to join' : 'Join';
  }

  isJoined(p: CourseCategory): boolean {
    return this.joinedIds().has(p.id);
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
      next: (enrollment) => {
        this.joiningId.set(null);
        if (enrollment.enrolled) {
          this.enrollments.update((list) => [
            ...list,
            {
              categoryId: p.id,
              categoryTitle: p.title,
              enrollmentStatus: enrollment.enrollmentStatus || 'ACTIVE',
              groupSyncStatus: enrollment.groupSyncStatus || 'PENDING',
              enrolled: true,
            },
          ]);
        } else if ((enrollment.enrollmentStatus || '').toUpperCase() === 'PENDING') {
          this.error.set('Join request sent. The programme coordinator must accept it before you can continue.');
        }
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

  onCoverError(id: string, coverImageUrl?: string | null): void {
    if (!coverImageUrl?.trim() || this.failedCovers().has(id)) return;
    this.failedCovers.update((prev) => new Set(prev).add(id));
  }

  cardCoverSrc(title: string, id: string, coverImageUrl?: string | null): string {
    if (coverImageUrl && !this.failedCovers().has(id)) {
      return this.programmeCoverUrl(title, id, coverImageUrl);
    }
    return this.coverTheme(title, id).url;
  }

  toggleYours(): void {
    this.yoursOpen.update((open) => !open);
  }

  toggleCreated(): void {
    this.createdOpen.update((open) => !open);
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

  setUniversity(university: string): void {
    this.selectedUniversity.set(university || 'All universities');
    this.uniMenuOpen.set(false);
    this.uniQuery.set('');
  }

  toggleUniversityMenu(event?: Event): void {
    event?.stopPropagation();
    this.uniMenuOpen.update((open) => !open);
    if (!this.uniMenuOpen()) {
      this.uniQuery.set('');
    }
  }

  onUniversityQuery(event: Event): void {
    this.uniQuery.set((event.target as HTMLInputElement).value);
  }

  clearUniversityFilter(event?: Event): void {
    event?.stopPropagation();
    this.setUniversity('All universities');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.uniMenuOpen()) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) {
      const wrap = (target as HTMLElement).closest?.('.uni-filter');
      if (wrap) return;
    }
    this.uniMenuOpen.set(false);
    this.uniQuery.set('');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.uniMenuOpen()) return;
    this.uniMenuOpen.set(false);
    this.uniQuery.set('');
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
    this.clearAutofillSearchLeak();
  }

  continueUnjoin(): void {
    this.unjoinError.set('');
    this.unjoinPassword.set('');
    this.unjoinStep.set('password');
  }

  onUnjoinPassword(event: Event): void {
    this.unjoinPassword.set((event.target as HTMLInputElement).value);
  }

  private clearAutofillSearchLeak(): void {
    const scrub = () => {
      const q = this.searchQuery().trim();
      if (q.includes('@')) this.searchQuery.set('');
    };
    scrub();
    setTimeout(scrub, 0);
    setTimeout(scrub, 100);
    setTimeout(scrub, 300);
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
      next: () => {
        this.coverDirty.set(false);
        this.coverUploadBusy.set(false);
        this.formCoverError.set('');
        this.refreshProgrammeCover(draft.id, true);
      },
      error: (err) => {
        this.coverUploadBusy.set(false);
        this.formCoverError.set(err?.error?.message || 'Could not upload cover image. Check that file storage is configured.');
      },
    });
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
      next: () => {
        this.refreshProgrammeCover(draft.id, true);
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
