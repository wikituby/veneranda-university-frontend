import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CourseAccess,
  CourseCategory,
  CourseContent,
  CourseDocument,
  CourseEnrollment,
  CourseLessonPayload,
  CourseLiveSession,
  CourseNode,
  CourseSlide,
  CourseSubscription,
  CourseVideo,
} from '../models/course.model';

interface CourseLessonResponse {
  categoryId: string;
  title: string;
  description?: string;
  notesBody?: string;
  slides?: CourseSlide[];
  videos?: CourseVideo[];
  documents?: CourseDocument[];
  liveSessions?: CourseLiveSession[];
  hasUnpublishedNotes?: boolean;
}

/**
 * Course service — categories and lesson media persist via backend API.
 */
@Injectable({ providedIn: 'root' })
export class CourseService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/course-categories`;
  /** Cached once per session — status rarely changes and was hit on every lesson open. */
  private r2Status$?: Observable<{ enabled: boolean }>;

  getCategories(publishedOnly = false): Observable<CourseCategory[]> {
    let params = new HttpParams();
    if (publishedOnly) {
      params = params.set('published', 'true');
    }
    return this.http.get<Record<string, unknown>[]>(this.baseUrl, { params }).pipe(
      map((categories) =>
        [...categories]
          .map((raw) => this.normalizeCategory(raw))
          .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      )
    );
  }

  getCourseTree(): Observable<CourseNode[]> {
    return this.getCategories().pipe(map((categories) => this.buildTree(categories)));
  }

  /** Load notes, slides, and videos for a lesson category. */
  getLesson(categoryId: string): Observable<CourseLessonResponse> {
    return this.http.get<CourseLessonResponse>(`${this.baseUrl}/${categoryId}/lesson`);
  }

  /** Persist notes, slides, and videos for a lesson category (staff draft). */
  saveLesson(categoryId: string, payload: CourseLessonPayload): Observable<CourseLessonResponse> {
    return this.http.put<CourseLessonResponse>(`${this.baseUrl}/${categoryId}/lesson`, payload);
  }

  /** Copy drafted notes to the student-facing published version. */
  publishLesson(categoryId: string): Observable<CourseLessonResponse> {
    return this.http.post<CourseLessonResponse>(`${this.baseUrl}/${categoryId}/lesson/publish`, {});
  }

  /**
   * Fetches lesson workspace content mapped for the course reader.
   */
  getContent(categoryId: string): Observable<CourseContent> {
    return this.getLesson(categoryId).pipe(
      map((lesson) => ({
        id: lesson.categoryId,
        categoryId: lesson.categoryId,
        title: lesson.title,
        description: lesson.description || '',
        body: lesson.notesBody || '',
        fileType: 'html' as const,
        orderIndex: 0,
        slides: (lesson.slides ?? []).map((s) => ({
          ...s,
          signedPlayback: !!(s as CourseSlide).signedPlayback || (s as CourseSlide).provider === 'r2',
        })),
        videos: (lesson.videos ?? []).map((v) => ({
          ...v,
          signedPlayback: !!(v as CourseVideo).signedPlayback || (v as CourseVideo).provider === 'r2',
        })),
        documents: (lesson.documents ?? []).map((d) => ({
          ...d,
          signedPlayback: !!(d as CourseDocument).signedPlayback || (d as CourseDocument).provider === 'r2',
        })),
        liveSessions: lesson.liveSessions ?? [],
        hasUnpublishedNotes: !!lesson.hasUnpublishedNotes,
      }))
    );
  }

  loadHtmlFile(path: string): Observable<string> {
    return this.http.get(path, { responseType: 'text' });
  }

  createRootCategory(title: string, description = '', googleGroupEmail?: string): Observable<CourseCategory> {
    return this.createCategory({
      title,
      description,
      googleGroupEmail: googleGroupEmail?.trim() || null,
      icon: 'folder',
      isPublished: true,
      nodeKind: 'PROGRAMME',
    });
  }

  createChildCategory(
    parentId: string,
    title: string,
    description = '',
    googleGroupEmail?: string,
    extras: Partial<CourseCategory> = {}
  ): Observable<CourseCategory> {
    return this.createCategory({
      title,
      description,
      googleGroupEmail: googleGroupEmail?.trim() || null,
      parentId,
      icon: extras.icon || 'folder_open',
      isPublished: true,
      ...extras,
    });
  }

  createCategory(payload: Partial<CourseCategory> & { title: string }): Observable<CourseCategory> {
    return this.http.post<CourseCategory>(this.baseUrl, payload);
  }

  updateCategory(id: string, patch: Partial<CourseCategory>): Observable<CourseCategory> {
    return this.http.put<CourseCategory>(`${this.baseUrl}/${id}`, patch);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getEnrollment(categoryId: string): Observable<CourseEnrollment> {
    return this.http.get<CourseEnrollment>(`${this.baseUrl}/${categoryId}/enrollment`);
  }

  enroll(categoryId: string): Observable<CourseEnrollment> {
    return this.http.post<CourseEnrollment>(`${this.baseUrl}/${categoryId}/enroll`, {});
  }

  unenroll(categoryId: string, password: string): Observable<CourseEnrollment> {
    return this.http.post<CourseEnrollment>(`${this.baseUrl}/${categoryId}/unenroll`, { password });
  }

  listMyEnrollments(): Observable<CourseEnrollment[]> {
    return this.http.get<CourseEnrollment[]>(`${this.baseUrl}/enrollments/mine`);
  }

  listMySubscriptions(): Observable<CourseSubscription[]> {
    return this.http.get<CourseSubscription[]>(`${this.baseUrl}/subscriptions/mine`);
  }

  getAccess(categoryId: string): Observable<CourseAccess> {
    return this.http.get<CourseAccess>(`${this.baseUrl}/${categoryId}/access`);
  }

  checkout(categoryId: string, trial = false): Observable<CourseSubscription> {
    let params = new HttpParams();
    if (trial) {
      params = params.set('trial', 'true');
    }
    return this.http.post<CourseSubscription>(`${this.baseUrl}/${categoryId}/checkout`, {}, { params });
  }

  unsubscribe(categoryId: string, password: string): Observable<CourseSubscription> {
    return this.http.post<CourseSubscription>(`${this.baseUrl}/${categoryId}/unsubscribe`, { password });
  }

  isR2Enabled(): Observable<{ enabled: boolean }> {
    if (!this.r2Status$) {
      this.r2Status$ = this.http.get<{ enabled: boolean }>(`${this.baseUrl}/r2/status`).pipe(
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.r2Status$;
  }

  uploadCoverImage(categoryId: string, file: File): Observable<CourseCategory> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<CourseCategory>(`${this.baseUrl}/${categoryId}/cover/upload`, form);
  }

  getCoverImage(categoryId: string): Observable<{ categoryId: string; url: string; expiresAt: string; provider: string }> {
    return this.http.get<{ categoryId: string; url: string; expiresAt: string; provider: string }>(
      `${this.baseUrl}/${categoryId}/cover`
    );
  }

  uploadR2Video(categoryId: string, file: File, title = ''): Observable<CourseVideo> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (title.trim()) {
      form.append('title', title.trim());
    }
    return this.http.post<CourseVideo>(`${this.baseUrl}/${categoryId}/videos/upload`, form);
  }

  getVideoPlayback(categoryId: string, videoId: string): Observable<{ videoId: string; url: string; expiresAt: string; provider: string }> {
    return this.http.get<{ videoId: string; url: string; expiresAt: string; provider: string }>(
      `${this.baseUrl}/${categoryId}/videos/${videoId}/playback`
    );
  }

  uploadR2Slide(categoryId: string, file: File, title = ''): Observable<CourseSlide> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (title.trim()) {
      form.append('title', title.trim());
    }
    return this.http.post<CourseSlide>(`${this.baseUrl}/${categoryId}/slides/upload`, form);
  }

  getSlideView(categoryId: string, slideId: string): Observable<{ slideId: string; url: string; expiresAt: string; provider: string; format: string }> {
    return this.http.get<{ slideId: string; url: string; expiresAt: string; provider: string; format: string }>(
      `${this.baseUrl}/${categoryId}/slides/${slideId}/view`
    );
  }

  uploadR2Document(categoryId: string, file: File, title = ''): Observable<CourseDocument> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (title.trim()) {
      form.append('title', title.trim());
    }
    return this.http.post<CourseDocument>(`${this.baseUrl}/${categoryId}/documents/upload`, form);
  }

  getDocumentView(categoryId: string, documentId: string): Observable<{ documentId: string; url: string; expiresAt: string; provider: string; format: string }> {
    return this.http.get<{ documentId: string; url: string; expiresAt: string; provider: string; format: string }>(
      `${this.baseUrl}/${categoryId}/documents/${documentId}/view`
    );
  }

  private normalizeCategory(raw: Record<string, unknown>): CourseCategory {
    const parent = raw['parent'];
    const parentIdFromObject =
      parent && typeof parent === 'object'
        ? String((parent as { uuid?: string; id?: string }).uuid || (parent as { id?: string }).id || '')
        : '';
    return {
      ...(raw as unknown as CourseCategory),
      id: String(raw['id'] ?? ''),
      parentId: String((raw['parentId'] ?? raw['parent_id'] ?? parentIdFromObject) || '') || null,
      nodeKind: (raw['nodeKind'] as CourseCategory['nodeKind']) || (raw['node_kind'] as CourseCategory['nodeKind']),
      programmeCode: String(raw['programmeCode'] ?? raw['programme_code'] ?? '') || null,
      abbreviation: String(raw['abbreviation'] ?? '') || null,
    };
  }

  buildTree(categories: CourseCategory[]): CourseNode[] {
    const map = new Map<string, CourseNode>();
    const roots: CourseNode[] = [];

    categories.forEach((cat) => {
      map.set(cat.id, { ...cat, children: [] });
    });

    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes: CourseNode[]) => {
      nodes.sort((a, b) => a.orderIndex - b.orderIndex);
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);

    return roots;
  }
}
