import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CourseService } from '../../core/services/course.service';
import { CourseCategory } from '../../core/models/course.model';
import { coverTheme, DEFAULT_INSTITUTION, programmeHeading } from '../../core/utils/programme.util';
import { CatalogueTopbar } from '../../layout/catalogue-topbar/catalogue-topbar';

@Component({
  selector: 'app-programme-browse',
  standalone: true,
  imports: [CommonModule, CatalogueTopbar],
  templateUrl: './programme-browse.html',
  styleUrl: './programme-browse.scss',
})
export class ProgrammeBrowse implements OnInit {
  private courses = inject(CourseService);
  private router = inject(Router);

  readonly coverTheme = coverTheme;
  readonly programmeHeading = programmeHeading;
  readonly defaultInstitution = DEFAULT_INSTITUTION;
  loading = signal(true);
  programmes = signal<CourseCategory[]>([]);
  enrolledIds = signal(new Set<string>());
  joiningId = signal<string | null>(null);
  error = signal('');
  failedCovers = signal(new Set<string>());

  ngOnInit(): void {
    forkJoin({
      cats: this.courses.getCategories(true),
      enrollments: this.courses.listMyEnrollments(),
    }).subscribe({
      next: ({ cats, enrollments }) => {
        this.programmes.set((cats || []).filter((c) => !c.parentId));
        this.enrolledIds.set(new Set((enrollments || []).filter((e) => e.enrolled).map((e) => e.categoryId)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load programmes.');
        this.loading.set(false);
      },
    });
  }

  isJoined(id: string): boolean {
    return this.enrolledIds().has(id);
  }

  openOrJoin(p: CourseCategory, event?: Event): void {
    event?.stopPropagation();
    if (this.isJoined(p.id)) {
      this.router.navigate(['/programmes', p.id]);
      return;
    }
    this.joiningId.set(p.id);
    this.courses.enroll(p.id).subscribe({
      next: () => {
        this.joiningId.set(null);
        this.enrolledIds.update((set) => new Set(set).add(p.id));
        this.router.navigate(['/programmes', p.id]);
      },
      error: () => {
        this.joiningId.set(null);
        this.error.set('Could not join this programme.');
      },
    });
  }

  onCoverError(id: string): void {
    this.failedCovers.update((s) => new Set(s).add(id));
  }

  showCover(id: string): boolean {
    return !this.failedCovers().has(id);
  }
}
