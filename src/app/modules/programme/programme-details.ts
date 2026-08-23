import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CourseService } from '../../core/services/course.service';
import { CourseCategory } from '../../core/models/course.model';
import {
  coverTheme,
  defaultPrice,
  formatKes,
  programmeStory,
  DEFAULT_INSTITUTION,
  programmeHeading,
  programmeCoverUrl,
} from '../../core/utils/programme.util';
import { CatalogueTopbar } from '../../layout/catalogue-topbar/catalogue-topbar';

@Component({
  selector: 'app-programme-details',
  standalone: true,
  imports: [CommonModule, RouterLink, CatalogueTopbar],
  templateUrl: './programme-details.html',
  styleUrl: './programme-details.scss',
})
export class ProgrammeDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private courses = inject(CourseService);

  readonly coverTheme = coverTheme;
  readonly programmeCoverUrl = programmeCoverUrl;
  readonly formatKes = formatKes;
  readonly programmeHeading = programmeHeading;
  readonly defaultInstitution = DEFAULT_INSTITUTION;

  loading = signal(true);
  joining = signal(false);
  subscribing = signal(false);
  error = signal('');
  coverFailed = signal(false);
  programme = signal<CourseCategory | null>(null);
  enrolled = signal(false);
  years = signal<CourseCategory[]>([]);
  units = signal<CourseCategory[]>([]);

  readonly theme = computed(() => {
    const p = this.programme();
    return p ? coverTheme(p.title, p.id, p.coverImageUrl) : coverTheme('', '');
  });

  readonly story = computed(() => {
    const p = this.programme();
    if (!p) return null;
    return programmeStory(p, this.units().map((u) => u.title));
  });

  readonly priceLabel = computed(() => {
    const p = this.programme();
    if (!p) return '';
    return formatKes(p.priceAmount ?? defaultPrice('PROGRAMME'), p.currency || 'KES');
  });

  facultyInitials(name: string): string {
    return (name || '')
      .replace(/,.*/, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigateByUrl('/home');
      return;
    }
    forkJoin({
      cats: this.courses.getCategories(true),
      enrollments: this.courses.listMyEnrollments().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ cats, enrollments }) => {
        const list = cats || [];
        const programme = list.find((c) => c.id === id && (c.nodeKind || 'PROGRAMME') === 'PROGRAMME') || null;
        this.programme.set(programme);
        this.coverFailed.set(false);
        this.enrolled.set((enrollments || []).some((e) => e.enrolled && e.categoryId === id));
        if (programme) {
          const years = list.filter((c) => c.parentId === programme.id);
          this.years.set(years);
          const yearIds = new Set(years.map((y) => y.id));
          const semesters = list.filter((c) => c.parentId && yearIds.has(c.parentId));
          const semesterIds = new Set(semesters.map((s) => s.id));
          this.units.set(list.filter((c) => c.parentId && semesterIds.has(c.parentId)));
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load this programme.');
        this.loading.set(false);
      },
    });
  }

  openWorkspace(): void {
    const p = this.programme();
    if (!p || this.joining()) return;
    if (this.enrolled()) {
      this.router.navigate(['/programmes', p.id]);
      return;
    }
    this.joining.set(true);
    this.error.set('');
    this.courses.enroll(p.id).subscribe({
      next: () => {
        this.enrolled.set(true);
        this.joining.set(false);
        this.router.navigate(['/programmes', p.id]);
      },
      error: () => {
        this.joining.set(false);
        this.error.set('Could not join this programme.');
      },
    });
  }

  openSubscribe(): void {
    const p = this.programme();
    if (!p || this.subscribing()) return;
    if (this.enrolled()) {
      this.router.navigate(['/checkout', p.id]);
      return;
    }
    this.subscribing.set(true);
    this.error.set('');
    this.courses.enroll(p.id).subscribe({
      next: () => {
        this.enrolled.set(true);
        this.subscribing.set(false);
        this.router.navigate(['/checkout', p.id]);
      },
      error: () => {
        this.subscribing.set(false);
        this.error.set('Could not join this programme.');
      },
    });
  }
}
