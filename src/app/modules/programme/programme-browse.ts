import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CourseService } from '../../core/services/course.service';
import { CourseCategory } from '../../core/models/course.model';
import { coverTheme, DEFAULT_INSTITUTION, programmeHeading, programmeCoverUrl } from '../../core/utils/programme.util';
import { CatalogueTopbar } from '../../layout/catalogue-topbar/catalogue-topbar';

@Component({
  selector: 'app-programme-browse',
  standalone: true,
  imports: [CommonModule, CatalogueTopbar],
  templateUrl: './programme-browse.html',
  styleUrl: './programme-browse.scss',
})
export class ProgrammeBrowse implements OnInit {
  private auth = inject(AuthService);
  private courses = inject(CourseService);
  private router = inject(Router);

  readonly coverTheme = coverTheme;
  readonly programmeCoverUrl = programmeCoverUrl;
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
    return (p.createdByName || '').trim();
  }

  hasCreator(p?: CourseCategory | null): boolean {
    return !!this.isCreatedByYou(p) || !!(p?.createdByName || '').trim();
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

  onCoverError(id: string, coverImageUrl?: string | null): void {
    if (!coverImageUrl?.trim() || this.failedCovers().has(id)) return;
    this.failedCovers.update((s) => new Set(s).add(id));
  }

  cardCoverSrc(title: string, id: string, coverImageUrl?: string | null): string {
    if (coverImageUrl && !this.failedCovers().has(id)) {
      return this.programmeCoverUrl(title, id, coverImageUrl);
    }
    return this.coverTheme(title, id).url;
  }

  showCover(id: string): boolean {
    return !this.failedCovers().has(id);
  }
}
