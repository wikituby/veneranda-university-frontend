import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CourseService } from '../../core/services/course.service';
import { CourseCategory } from '../../core/models/course.model';
import { environment } from '../../../environments/environment';
import { DEFAULT_INSTITUTION, formatMoney, programmeHeading, subscriptionTotal } from '../../core/utils/programme.util';
import { InstitutionPicker } from '../../shared/institution-picker/institution-picker';

@Component({
  selector: 'app-programme-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, InstitutionPicker],
  templateUrl: './programme-create.html',
  styleUrl: './programme-create.scss',
})
export class ProgrammeCreate {
  private courses = inject(CourseService);
  private router = inject(Router);

  step = signal(1);
  saving = signal(false);
  error = signal('');

  title = '';
  description = '';
  programmeCode = '';
  abbreviation = '';
  institution = DEFAULT_INSTITUTION;
  /** OPEN = free join; REQUEST = approval required. */
  joinMode: 'OPEN' | 'REQUEST' = 'OPEN';
  currency = environment.defaultCurrency || 'UGX';
  /** Coordinator share for the programme-level subscription. */
  coordinatorShare = 250000;
  readonly serverFee = environment.serverFeeAmount ?? 5000;
  readonly formatMoney = formatMoney;
  coverImageUrl = '';
  coverError = '';
  pendingCoverFile: File | null = null;
  readonly programmeHeading = programmeHeading;
  programme = signal<CourseCategory | null>(null);
  years = signal<CourseCategory[]>([]);
  yearTitle = 'Year 1';
  selectedYear = signal<CourseCategory | null>(null);
  semesters = signal<CourseCategory[]>([]);
  semesterTitle = 'Semester 1';
  semesterPrice = 40000;
  semesterCurrency = environment.defaultCurrency || 'UGX';
  selectedSemester = signal<CourseCategory | null>(null);
  units = signal<CourseCategory[]>([]);
  unitTitle = '';
  unitCode = '';
  unitAbbreviation = '';
  unitPrice = 15000;
  unitCurrency = environment.defaultCurrency || 'UGX';

  get programmeTotal(): number {
    return subscriptionTotal(this.coordinatorShare, 'PROGRAMME', this.serverFee);
  }


  onCoverFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.coverError = 'Choose an image file (JPG, PNG, WebP, or GIF).';
      return;
    }
    if (file.size > 5_000_000) {
      this.coverError = 'Image must be under 5 MB.';
      return;
    }
    this.revokeCoverPreview();
    this.pendingCoverFile = file;
    this.coverImageUrl = URL.createObjectURL(file);
    this.coverError = '';
  }

  clearCoverImage(): void {
    this.revokeCoverPreview();
    this.pendingCoverFile = null;
    this.coverImageUrl = '';
    this.coverError = '';
  }

  createProgramme(): void {
    if (!this.title.trim()) {
      this.error.set('Enter the programme name.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const pastedUrl = this.pendingCoverFile ? null : this.coverImageUrl.trim() || null;
    this.courses
      .createCategory({
        title: this.title.trim(),
        description: this.description.trim(),
        programmeCode: this.programmeCode.trim() || null,
        abbreviation: this.abbreviation.trim() || null,
        affiliatedInstitution: this.institution,
        coverImageUrl: pastedUrl,
        nodeKind: 'PROGRAMME',
        isPublished: true,
        icon: 'school',
        joinMode: this.joinMode,
        currency: this.currency,
        priceAmount: this.coordinatorShare,
      })
      .subscribe({
        next: (created) => {
          if (this.pendingCoverFile) {
            this.uploadCoverAfterCreate(created);
            return;
          }
          this.finishCreate(created);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Could not register the programme.');
        },
      });
  }

  private uploadCoverAfterCreate(created: CourseCategory): void {
    const file = this.pendingCoverFile;
    if (!file) {
      this.finishCreate(created);
      return;
    }
    this.courses.uploadCoverImage(created.id, file).subscribe({
      next: () => this.finishCreate(created),
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Programme created, but the cover image could not be uploaded.');
        this.programme.set(created);
        this.step.set(2);
      },
    });
  }

  private finishCreate(created: CourseCategory): void {
    this.revokeCoverPreview();
    this.pendingCoverFile = null;
    this.saving.set(false);
    this.programme.set(created);
    this.step.set(2);
  }

  private revokeCoverPreview(): void {
    if (this.coverImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.coverImageUrl);
    }
  }

  addYear(): void {
    const parent = this.programme();
    if (!parent || !this.yearTitle.trim()) return;
    this.saving.set(true);
    this.courses
      .createChildCategory(parent.id, this.yearTitle.trim(), '', undefined, { nodeKind: 'YEAR', icon: 'calendar_month' })
      .subscribe({
        next: (year) => {
          this.years.update((list) => [...list, year]);
          this.selectedYear.set(year);
          this.yearTitle = `Year ${this.years().length + 1}`;
          this.saving.set(false);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Could not add the year.');
        },
      });
  }

  selectYear(year: CourseCategory): void {
    this.selectedYear.set(year);
    this.selectedSemester.set(null);
    this.semesters.set([]);
    this.units.set([]);
    this.courses.getCategories(false).subscribe((cats) => {
      this.semesters.set((cats || []).filter((c) => c.parentId === year.id));
    });
  }

  addSemester(): void {
    const year = this.selectedYear();
    if (!year) {
      this.error.set('Select a year first.');
      return;
    }
    this.saving.set(true);
    this.courses
      .createChildCategory(year.id, this.semesterTitle.trim(), '', undefined, {
        nodeKind: 'SEMESTER',
        icon: 'view_week',
        priceAmount: this.semesterPrice,
        currency: this.semesterCurrency || this.currency,
      })
      .subscribe({
        next: (sem) => {
          this.semesters.update((list) => [...list, sem]);
          this.selectedSemester.set(sem);
          this.saving.set(false);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Could not add the semester.');
        },
      });
  }

  selectSemester(sem: CourseCategory): void {
    this.selectedSemester.set(sem);
    this.courses.getCategories(false).subscribe((cats) => {
      this.units.set((cats || []).filter((c) => c.parentId === sem.id));
    });
  }

  addUnit(): void {
    const sem = this.selectedSemester();
    if (!sem || !this.unitTitle.trim()) return;
    this.saving.set(true);
    this.courses
      .createChildCategory(sem.id, this.unitTitle.trim(), '', undefined, {
        nodeKind: 'UNIT',
        icon: 'menu_book',
        priceAmount: this.unitPrice,
        currency: this.unitCurrency || this.currency,
        programmeCode: this.unitCode.trim() || null,
        abbreviation: this.unitAbbreviation.trim() || null,
      })
      .subscribe({
        next: (unit) => {
          this.units.update((list) => [...list, unit]);
          this.unitTitle = '';
          this.unitCode = '';
          this.unitAbbreviation = '';
          this.saving.set(false);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Could not add the course unit.');
        },
      });
  }

  finish(): void {
    const p = this.programme();
    if (p) this.router.navigate(['/programmes', p.id]);
    else this.router.navigateByUrl('/explore');
  }
}
