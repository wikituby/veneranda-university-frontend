import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CourseService } from '../../core/services/course.service';
import { CourseCategory, CourseNode, CourseSubscription } from '../../core/models/course.model';
import { coverTheme, defaultPrice, formatKes, AFFILIATED_INSTITUTIONS, DEFAULT_INSTITUTION, programmeHeading } from '../../core/utils/programme.util';
import { CatalogueTopbar } from '../../layout/catalogue-topbar/catalogue-topbar';

@Component({
  selector: 'app-programme-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CatalogueTopbar],
  templateUrl: './programme-page.html',
  styleUrl: './programme-page.scss',
})
export class ProgrammePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private courses = inject(CourseService);
  private auth = inject(AuthService);

  readonly formatKes = formatKes;
  readonly coverTheme = coverTheme;
  readonly defaultPrice = defaultPrice;
  readonly programmeHeading = programmeHeading;
  readonly defaultInstitution = DEFAULT_INSTITUTION;
  readonly institutions = AFFILIATED_INSTITUTIONS;

  loading = signal(true);
  error = signal('');
  joining = signal(false);
  unjoining = signal(false);
  unjoinStep = signal<'warn' | 'password' | null>(null);
  unjoinPassword = signal('');
  unjoinError = signal('');
  hideUnjoinPassword = signal(true);
  unsubscribingId = signal<string | null>(null);
  pendingUnsubscribe = signal<{ id: string; title: string; kind: string } | null>(null);
  unsubscribePassword = signal('');
  unsubscribeError = signal('');
  hideUnsubscribePassword = signal(true);
  programme = signal<CourseCategory | null>(null);
  years = signal<CourseNode[]>([]);
  enrolled = signal(false);
  paidIds = signal(new Set<string>());
  subscriptions = signal(new Map<string, CourseSubscription>());
  private ignoredPaidIds = signal(new Set<string>());
  openYears = signal(new Set<string>());
  openSemesters = signal(new Set<string>());
  adding = signal<{ kind: 'YEAR' | 'SEMESTER' | 'UNIT'; parentId: string } | null>(null);
  editing = signal<{ id: string; kind: 'PROGRAMME' | 'YEAR' | 'SEMESTER' | 'UNIT' } | null>(null);
  formTitle = signal('');
  formDescription = signal('');
  formProgrammeCode = signal('');
  formAbbreviation = signal('');
  formInstitution = signal<string>(DEFAULT_INSTITUTION);
  formCoverImageUrl = signal('');
  formCoverError = signal('');
  coverDirty = signal(false);
  coverUploadBusy = signal(false);
  addingBusy = signal(false);

  canManage = computed(() => {
    const p = this.programme();
    if (!p) return false;
    return this.auth.canManageProgramme(p.createdBy);
  });

  isStaff(): boolean {
    return this.auth.canManageCourseContent();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigateByUrl('/programmes');
      return;
    }
    this.load(id);
  }

  load(id: string, preserveOpen = false): void {
    const openYears = this.openYears();
    const openSemesters = this.openSemesters();
    if (!preserveOpen) this.loading.set(true);
    this.error.set('');
    forkJoin({
      cats: this.courses.getCategories(true),
      enrollments: this.courses.listMyEnrollments(),
      subs: this.courses.listMySubscriptions(),
      access: this.courses.getAccess(id),
    }).subscribe({
      next: ({ cats, enrollments, subs, access }) => {
        const all = cats || [];
        const prog = all.find((c) => c.id === id) || null;
        this.programme.set(prog);
        this.enrolled.set(!!access.enrolled || enrollments.some((e) => e.enrolled && e.categoryId === id));
        const ignored = this.ignoredPaidIds();
        const paid = (subs || []).filter((s) => this.isActiveSub(s) && !ignored.has(s.categoryId));
        this.paidIds.set(new Set(paid.map((s) => s.categoryId)));
        this.subscriptions.set(new Map(paid.map((s) => [s.categoryId, s])));
        const tree = this.buildChildren(all, id);
        this.years.set(tree);
        if (preserveOpen) {
          const yearIds = new Set(tree.map((y) => y.id));
          const semesterIds = new Set(tree.flatMap((y) => y.children.map((s) => s.id)));
          this.openYears.set(new Set([...openYears].filter((id) => yearIds.has(id))));
          this.openSemesters.set(new Set([...openSemesters].filter((id) => semesterIds.has(id))));
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load this programme.');
        this.loading.set(false);
      },
    });
  }

  join(): void {
    const p = this.programme();
    if (!p) return;
    this.joining.set(true);
    this.courses.enroll(p.id).subscribe({
      next: () => {
        this.joining.set(false);
        this.enrolled.set(true);
      },
      error: () => {
        this.joining.set(false);
        this.error.set('Could not join this programme.');
      },
    });
  }

  hasPaidInProgramme(): boolean {
    const p = this.programme();
    if (!p) return false;
    if (this.isPaid(p.id)) return true;
    for (const year of this.years()) {
      if (this.isPaid(year.id)) return true;
      for (const semester of year.children) {
        if (this.isPaid(semester.id)) return true;
        if (semester.children.some((unit) => this.isPaid(unit.id))) return true;
      }
    }
    return false;
  }

  unjoin(): void {
    if (!this.programme() || this.unjoining()) return;
    this.unjoinError.set('');
    this.unjoinPassword.set('');
    this.hideUnjoinPassword.set(true);
    this.unjoinStep.set('warn');
  }

  cancelUnjoin(): void {
    if (this.unjoining()) return;
    this.unjoinStep.set(null);
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
    const p = this.programme();
    const password = this.unjoinPassword().trim();
    if (!p || this.unjoining()) return;
    if (!password) {
      this.unjoinError.set('Enter your password to confirm.');
      return;
    }
    this.unjoining.set(true);
    this.unjoinError.set('');
    this.courses.unenroll(p.id, password).subscribe({
      next: () => {
        this.unjoining.set(false);
        this.unjoinStep.set(null);
        this.unjoinPassword.set('');
        this.router.navigateByUrl('/home');
      },
      error: (err) => {
        this.unjoining.set(false);
        this.unjoinError.set(err?.error?.message || 'Could not unjoin this programme.');
      },
    });
  }

  unsubscribe(categoryId: string, event?: Event): void {
    event?.stopPropagation();
    if (!categoryId || this.unsubscribingId()) return;
    const item = this.findCategory(categoryId);
    this.pendingUnsubscribe.set({
      id: categoryId,
      title: item?.title || 'this section',
      kind: item?.nodeKind || 'section',
    });
    this.unsubscribePassword.set('');
    this.unsubscribeError.set('');
    this.hideUnsubscribePassword.set(true);
  }

  cancelUnsubscribe(): void {
    if (this.unsubscribingId()) return;
    this.pendingUnsubscribe.set(null);
    this.unsubscribePassword.set('');
    this.unsubscribeError.set('');
  }

  onUnsubscribePassword(event: Event): void {
    this.unsubscribePassword.set((event.target as HTMLInputElement).value);
  }

  confirmUnsubscribe(): void {
    const pending = this.pendingUnsubscribe();
    const password = this.unsubscribePassword().trim();
    if (!pending || this.unsubscribingId()) return;
    if (!password) {
      this.unsubscribeError.set('Enter your password to confirm.');
      return;
    }
    this.unsubscribingId.set(pending.id);
    this.unsubscribeError.set('');
    this.error.set('');
    this.courses.unsubscribe(pending.id, password).subscribe({
      next: () => {
        this.releaseCoverage(pending.id);
        this.unsubscribingId.set(null);
        this.pendingUnsubscribe.set(null);
        this.unsubscribePassword.set('');
        const programme = this.programme();
        if (programme) this.load(programme.id, true);
      },
      error: (err) => {
        this.unsubscribingId.set(null);
        this.unsubscribeError.set(err?.error?.message || 'Could not unsubscribe.');
      },
    });
  }

  unsubscribeKindLabel(): string {
    switch (this.pendingUnsubscribe()?.kind) {
      case 'PROGRAMME':
        return 'programme';
      case 'YEAR':
        return 'year';
      case 'SEMESTER':
        return 'semester';
      case 'UNIT':
        return 'course unit';
      default:
        return 'section';
    }
  }

  unsubscribePreview(): {
    trial: boolean;
    paidLabel: string;
    usedDays: number;
    chargedLabel: string;
    refundLabel: string;
  } {
    const pending = this.pendingUnsubscribe();
    const sub = pending ? this.subscriptions().get(pending.id) : undefined;
    const currency = sub?.currency || this.programme()?.currency || 'KES';
    if (!sub || this.isTrialSub(sub)) {
      return {
        trial: true,
        paidLabel: 'Free trial',
        usedDays: 0,
        chargedLabel: this.moneyLabel(0, currency),
        refundLabel: this.moneyLabel(0, currency),
      };
    }

    const paid = Number(sub.amount) || 0;
    const paidAt = sub.paidAt ? Date.parse(sub.paidAt) : NaN;
    const now = Date.now();
    const start = Number.isNaN(paidAt) ? now : paidAt;
    const usedDays = Math.max(0, Math.floor((now - start) / 86_400_000));
    const totalDays = this.subscriptionSpanDays(sub, pending?.kind);
    const charged = totalDays <= 0 ? paid : Math.min(paid, (paid * usedDays) / totalDays);
    const refund = Math.max(0, paid - charged);
    return {
      trial: false,
      paidLabel: this.moneyLabel(paid, currency),
      usedDays,
      chargedLabel: this.moneyLabel(charged, currency),
      refundLabel: this.moneyLabel(refund, currency),
    };
  }

  private moneyLabel(amount: number, currency: string): string {
    return `${currency} ${Math.round(Number(amount) || 0).toLocaleString('en-KE')}`;
  }

  private subscriptionSpanDays(sub: CourseSubscription, kind?: string): number {
    const paidAt = sub.paidAt ? Date.parse(sub.paidAt) : NaN;
    const expiresAt = sub.expiresAt ? Date.parse(sub.expiresAt) : NaN;
    if (!Number.isNaN(paidAt) && !Number.isNaN(expiresAt) && expiresAt > paidAt) {
      return Math.max(1, Math.ceil((expiresAt - paidAt) / 86_400_000));
    }
    switch (kind) {
      case 'SEMESTER':
        return 120;
      case 'UNIT':
        return 90;
      default:
        return 365;
    }
  }

  private findCategory(id: string): CourseCategory | undefined {
    const programme = this.programme();
    if (programme?.id === id) return programme;
    for (const year of this.years()) {
      if (year.id === id) return year;
      for (const sem of year.children) {
        if (sem.id === id) return sem;
        const unit = sem.children.find((child) => child.id === id);
        if (unit) return unit;
      }
    }
    return undefined;
  }

  isPaid(id: string): boolean {
    return this.paidIds().has(id) && !this.ignoredPaidIds().has(id);
  }

  ownsSubscription(id: string, ancestors: string[] = []): boolean {
    return this.isPaid(id) && !ancestors.some((ancestorId) => this.isPaid(ancestorId));
  }

  isYearCovered(yearId: string): boolean {
    return this.isCovered(yearId);
  }

  isSemesterCovered(semesterId: string, yearId: string): boolean {
    return this.isCovered(semesterId, [yearId]);
  }

  yearPaidLabel(year: CourseCategory): string {
    return this.paidLabel(year.id, year.priceAmount ?? this.defaultPrice('YEAR'), year.currency);
  }

  semesterPaidLabel(sem: CourseCategory, yearId: string): string {
    return this.paidLabel(sem.id, sem.priceAmount ?? this.defaultPrice('SEMESTER'), sem.currency, [yearId]);
  }

  unitPaidLabel(unit: CourseCategory, semesterId: string, yearId: string): string {
    return this.paidLabel(unit.id, unit.priceAmount ?? this.defaultPrice('UNIT'), unit.currency, [semesterId, yearId]);
  }

  coveringSub(id: string, ancestors: string[] | string = []): CourseSubscription | undefined {
    const extra = typeof ancestors === 'string' ? [ancestors] : ancestors;
    const keys = [id, ...extra.filter(Boolean)];
    const programmeId = this.programme()?.id;
    if (programmeId && !keys.includes(programmeId)) keys.push(programmeId);
    const ignored = this.ignoredPaidIds();
    for (const key of keys) {
      if (!key || ignored.has(key)) continue;
      const sub = this.subscriptions().get(key);
      if (sub && this.isActiveSub(sub)) return sub;
    }
    return undefined;
  }

  isCovered(id: string, ancestors: string[] | string = []): boolean {
    return this.coveredIds().has(id) || !!this.coveringSub(id, ancestors);
  }

  readonly coveredIds = computed(() => {
    const paid = this.paidIds();
    const ignored = this.ignoredPaidIds();
    const ids = new Set<string>();
    const take = (id: string): boolean => paid.has(id) && !ignored.has(id);
    const addSubtree = (nodes: CourseNode[]) => {
      for (const node of nodes) {
        ids.add(node.id);
        addSubtree(node.children || []);
      }
    };
    const programme = this.programme();
    if (programme && take(programme.id)) {
      ids.add(programme.id);
      addSubtree(this.years());
    }
    for (const year of this.years()) {
      if (take(year.id)) {
        ids.add(year.id);
        addSubtree(year.children || []);
      }
      for (const sem of year.children || []) {
        if (take(sem.id)) {
          ids.add(sem.id);
          addSubtree(sem.children || []);
        }
        for (const unit of sem.children || []) {
          if (take(unit.id)) ids.add(unit.id);
        }
      }
    }
    return ids;
  });

  paidLabel(id: string, catalogAmount?: number | null, currency?: string, ancestors: string[] | string = []): string {
    const sub = this.coveringSub(id, ancestors);
    if (sub && this.isActiveSub(sub)) {
      if (this.isTrialSub(sub)) return 'Free trial';
      return this.formatKes(sub.amount, sub.currency || currency || 'KES');
    }
    return this.formatKes(catalogAmount ?? 0, currency || 'KES');
  }

  private isTrialSub(sub: CourseSubscription): boolean {
    return sub.paymentMethod === 'TRIAL' || Number(sub.amount) === 0;
  }

  private isActiveSub(sub: CourseSubscription): boolean {
    if (!sub || sub.paymentStatus === 'CANCELLED' || sub.paymentStatus === 'FAILED' || sub.paymentStatus === 'EXPIRED') return false;
    if (sub.paymentStatus && sub.paymentStatus !== 'PAID') return false;
    if (sub.paid === false) return false;
    if (sub.expiresAt) {
      const expires = Date.parse(sub.expiresAt);
      if (!Number.isNaN(expires) && expires <= Date.now()) return false;
    }
    return !!sub.paid || sub.paymentMethod === 'TRIAL' || sub.paymentStatus === 'PAID';
  }

  private releaseCoverage(categoryId: string): void {
    const drop = new Set(this.descendantIds(categoryId));
    drop.add(categoryId);
    this.ignoredPaidIds.set(new Set([...this.ignoredPaidIds(), ...drop]));
    const paid = new Set(this.paidIds());
    const next = new Map(this.subscriptions());
    for (const id of drop) {
      paid.delete(id);
      next.delete(id);
    }
    this.paidIds.set(paid);
    this.subscriptions.set(next);
  }

  private descendantIds(categoryId: string): string[] {
    const programme = this.programme();
    if (programme?.id === categoryId) {
      return this.years().flatMap((year) => [year.id, ...this.descendantIds(year.id)]);
    }
    const ids: string[] = [];
    for (const year of this.years()) {
      if (year.id === categoryId) {
        for (const sem of year.children) {
          ids.push(sem.id, ...sem.children.map((unit) => unit.id));
        }
        return ids;
      }
      for (const sem of year.children) {
        if (sem.id === categoryId) {
          return sem.children.map((unit) => unit.id);
        }
      }
    }
    return ids;
  }

  programmeUnlocked(): boolean {
    const p = this.programme();
    return this.isStaff() || !!(p && this.isPaid(p.id));
  }

  yearUnlocked(yearId: string): boolean {
    return this.isStaff() || this.coveredIds().has(yearId);
  }

  semesterUnlocked(semesterId: string, yearId: string): boolean {
    return this.isStaff() || this.coveredIds().has(semesterId) || this.coveredIds().has(yearId);
  }

  unitUnlocked(unit: CourseCategory, semesterId: string, yearId: string): boolean {
    return this.isStaff() || this.coveredIds().has(unit.id) || this.coveredIds().has(semesterId) || this.coveredIds().has(yearId);
  }

  unitAccessible(unit: CourseCategory, semesterId: string): boolean {
    const year = this.years().find((y) => y.children.some((s) => s.id === semesterId));
    return this.unitUnlocked(unit, semesterId, year?.id || '');
  }

  subscribe(categoryId: string, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/checkout', categoryId]);
  }

  canPay(): boolean {
    return this.isStaff() || this.enrolled();
  }

  covers(id: string, ancestors: string[] | string = []): boolean {
    return this.isCovered(id, ancestors);
  }

  openUnit(unit: CourseCategory, semesterId: string): void {
    if (this.isStaff() || this.unitAccessible(unit, semesterId)) {
      this.router.navigate(['/course', unit.id]);
      return;
    }
    this.router.navigate(['/checkout', unit.id]);
  }

  onUnitCardClick(unit: CourseCategory, semesterId: string): void {
    if (!this.unitAccessible(unit, semesterId)) return;
    this.openUnit(unit, semesterId);
  }

  isYearOpen(id: string): boolean {
    return this.openYears().has(id);
  }

  isSemesterOpen(id: string): boolean {
    return this.openSemesters().has(id);
  }

  toggleYear(id: string): void {
    this.openYears.set(this.toggleOpen(this.openYears(), id));
  }

  toggleSemester(id: string): void {
    this.openSemesters.set(this.toggleOpen(this.openSemesters(), id));
  }

  private toggleOpen(current: Set<string>, id: string): Set<string> {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  private ensureOpen(kind: 'year' | 'semester', id: string): void {
    if (kind === 'year') {
      const next = new Set(this.openYears());
      next.add(id);
      this.openYears.set(next);
      return;
    }
    const next = new Set(this.openSemesters());
    next.add(id);
    this.openSemesters.set(next);
  }

  startAddYear(): void {
    const p = this.programme();
    if (!p) return;
    this.closeForm();
    this.adding.set({ kind: 'YEAR', parentId: p.id });
    this.formTitle.set(`Year ${this.years().length + 1}`);
    this.formDescription.set('');
  }

  startAddSemester(year: CourseNode, event?: Event): void {
    event?.stopPropagation();
    this.closeForm();
    this.adding.set({ kind: 'SEMESTER', parentId: year.id });
    this.formTitle.set(`Semester ${year.children.length + 1}`);
    this.formDescription.set('');
  }

  startAddUnit(semester: CourseNode, yearId: string, event?: Event): void {
    event?.stopPropagation();
    this.closeForm();
    this.adding.set({ kind: 'UNIT', parentId: semester.id });
    this.formTitle.set('');
    this.formDescription.set('');
  }

  startEdit(item: CourseCategory, event?: Event, yearId?: string, semesterId?: string): void {
    event?.stopPropagation();
    this.closeForm();
    const kind = (item.nodeKind as 'PROGRAMME' | 'YEAR' | 'SEMESTER' | 'UNIT' | undefined) || 'PROGRAMME';
    this.editing.set({ id: item.id, kind });
    this.formTitle.set(item.title);
    this.formDescription.set(item.description || '');
    this.formProgrammeCode.set(item.programmeCode || '');
    this.formAbbreviation.set(item.abbreviation || '');
    this.formInstitution.set(item.affiliatedInstitution || DEFAULT_INSTITUTION);
    this.formCoverImageUrl.set(item.coverImageUrl || '');
    this.formCoverError.set('');
    this.coverDirty.set(false);
    this.coverUploadBusy.set(false);
  }

  closeForm(): void {
    this.adding.set(null);
    this.editing.set(null);
    this.formTitle.set('');
    this.formDescription.set('');
    this.formProgrammeCode.set('');
    this.formAbbreviation.set('');
    this.formInstitution.set(DEFAULT_INSTITUTION);
    this.formCoverImageUrl.set('');
    this.formCoverError.set('');
    this.coverDirty.set(false);
    this.coverUploadBusy.set(false);
  }

  formOpen(): boolean {
    return !!this.adding() || !!this.editing();
  }

  formKindLabel(): string {
    const kind = this.adding()?.kind || this.editing()?.kind;
    switch (kind) {
      case 'PROGRAMME':
        return 'programme';
      case 'YEAR':
        return 'year';
      case 'SEMESTER':
        return 'semester';
      case 'UNIT':
        return 'course unit';
      default:
        return 'section';
    }
  }

  showCodeFields(): boolean {
    const kind = this.adding()?.kind || this.editing()?.kind;
    return kind === 'PROGRAMME' || kind === 'UNIT';
  }

  codeFieldLabel(): string {
    return this.editing()?.kind === 'PROGRAMME' ? 'Programme code' : 'Course code';
  }

  codePlaceholder(): string {
    return this.editing()?.kind === 'PROGRAMME' ? 'e.g. DCMCH-001' : 'e.g. ANAT-101';
  }

  abbreviationPlaceholder(): string {
    return this.editing()?.kind === 'PROGRAMME' ? 'e.g. DCMCH' : 'e.g. ANAT';
  }

  formCrumbs(): string[] {
    const programmeTitle = this.programmeHeading(this.programme()) || 'Programme';
    const years = this.years();
    const editing = this.editing();
    if (editing) {
      if (editing.kind === 'PROGRAMME') return [programmeTitle];
      if (editing.kind === 'YEAR') {
        const year = years.find((y) => y.id === editing.id);
        return [programmeTitle, year?.title || 'Year'];
      }
      if (editing.kind === 'SEMESTER') {
        const year = years.find((y) => y.children.some((s) => s.id === editing.id));
        const semester = year?.children.find((s) => s.id === editing.id);
        return [programmeTitle, year?.title || 'Year', semester?.title || 'Semester'];
      }
      for (const year of years) {
        for (const semester of year.children) {
          const unit = semester.children.find((u) => u.id === editing.id);
          if (unit) return [programmeTitle, year.title, semester.title, this.programmeHeading(unit)];
        }
      }
      return [programmeTitle];
    }

    const adding = this.adding();
    if (!adding) return [];
    if (adding.kind === 'YEAR') return [programmeTitle];
    if (adding.kind === 'SEMESTER') {
      const year = years.find((y) => y.id === adding.parentId);
      return [programmeTitle, year?.title || 'Year'];
    }
    for (const year of years) {
      const semester = year.children.find((s) => s.id === adding.parentId);
      if (semester) return [programmeTitle, year.title, semester.title];
    }
    return [programmeTitle];
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
    if (!file || !draft || draft.kind !== 'PROGRAMME') return;
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

  confirmForm(): void {
    if (this.editing()) {
      this.confirmEdit();
      return;
    }
    this.confirmAdd();
  }

  private confirmEdit(): void {
    const draft = this.editing();
    const title = this.formTitle().trim();
    const programme = this.programme();
    if (!draft || !title || !programme || this.addingBusy()) return;
    this.addingBusy.set(true);
    this.error.set('');
    const patch: Partial<CourseCategory> = {
      title,
      description: this.formDescription().trim(),
    };
    if (draft.kind === 'PROGRAMME' || draft.kind === 'UNIT') {
      if (draft.kind === 'PROGRAMME') {
        patch.affiliatedInstitution = this.formInstitution();
        if (this.coverDirty()) {
          patch.coverImageUrl = this.formCoverImageUrl().trim();
        }
      }
      patch.programmeCode = this.formProgrammeCode().trim() || null;
      patch.abbreviation = this.formAbbreviation().trim() || null;
    }
    this.courses.updateCategory(draft.id, patch).subscribe({
      next: () => {
        this.addingBusy.set(false);
        this.closeForm();
        this.load(programme.id, true);
      },
      error: () => {
        this.addingBusy.set(false);
        this.error.set('Could not save the changes.');
      },
    });
  }

  private confirmAdd(): void {
    const draft = this.adding();
    const title = this.formTitle().trim();
    const programme = this.programme();
    if (!draft || !title || !programme || this.addingBusy()) return;
    this.addingBusy.set(true);
    this.error.set('');

    const extras =
      draft.kind === 'YEAR'
        ? { nodeKind: 'YEAR' as const, icon: 'calendar_month' }
        : draft.kind === 'SEMESTER'
          ? { nodeKind: 'SEMESTER' as const, icon: 'view_week', priceAmount: 40000 }
          : {
              nodeKind: 'UNIT' as const,
              icon: 'menu_book',
              priceAmount: 15000,
              programmeCode: this.formProgrammeCode().trim() || null,
              abbreviation: this.formAbbreviation().trim() || null,
            };

    this.courses.createChildCategory(draft.parentId, title, this.formDescription().trim(), undefined, extras).subscribe({
      next: (created) => {
        this.addingBusy.set(false);
        this.closeForm();
        if (draft.kind === 'YEAR') this.ensureOpen('year', created.id);
        if (draft.kind === 'SEMESTER') {
          this.ensureOpen('year', draft.parentId);
          this.ensureOpen('semester', created.id);
        }
        if (draft.kind === 'UNIT') this.ensureOpen('semester', draft.parentId);
        this.load(programme.id, true);
      },
      error: () => {
        this.addingBusy.set(false);
        this.error.set(
          draft.kind === 'YEAR'
            ? 'Could not add the year.'
            : draft.kind === 'SEMESTER'
              ? 'Could not add the semester.'
              : 'Could not add the course unit.',
        );
      },
    });
  }

  private buildChildren(all: CourseCategory[], parentId: string): CourseNode[] {
    return all
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((c) => ({ ...c, children: this.buildChildren(all, c.id), isExpanded: true }));
  }
}
