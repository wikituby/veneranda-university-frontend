import { Component, HostListener, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import type QuillType from 'quill';
import { AuthService } from '../../core/services/auth.service';
import { CourseService } from '../../core/services/course.service';
import { CourseCategory, CourseContent, CourseDocument, CourseEnrollment, CourseLiveSession, CourseSlide, CourseVideo } from '../../core/models/course.model';
import { Subscription } from 'rxjs';

export type ReaderTab = 'notes' | 'slides' | 'videos' | 'documents' | 'live';

interface SlideBuilderCard {
  id: string;
  title: string;
  bullets: string;
  imageName?: string;
  imageDataUrl?: string;
}

/**
 * Renders a leaf course item with Notes / Slides / Documents / Videos tabs.
 * Lesson media is persisted via the backend. YouTube embeds use a click shield
 * to block in-player share/copy UI (best-effort; not DRM).
 */
@Component({
  selector: 'app-course-reader',
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './course-reader.html',
  styleUrl: './course-reader.scss',
})
export class CourseReader implements OnDestroy {
  private courseService = inject(CourseService);
  private authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  contentId = input<string>('');
  mode = input<'content' | 'file'>('content');
  private outlineCategories = signal<CourseCategory[]>([]);
  private outlineCatsSub?: Subscription;

  /** Unit › outline ancestors › this item. */
  outlineBreadcrumb = computed(() => {
    const id = this.contentId();
    const categories = this.outlineCategories();
    if (!id || !categories.length) return '';

    const byId = new Map<string, CourseCategory>();
    for (const category of categories) {
      if (category.id) byId.set(category.id, category);
    }
    const current =
      byId.get(id) ?? categories.find((category) => category.contentId === id) ?? null;
    if (!current) return '';

    const chain: CourseCategory[] = [];
    const seen = new Set<string>();
    let cursor: CourseCategory | null = current;
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      chain.unshift(cursor);
      if (cursor.nodeKind === 'UNIT') break;
      cursor = cursor.parentId ? byId.get(cursor.parentId) ?? null : null;
    }

    return chain
      .map((category) => category.title?.trim())
      .filter((title): title is string => !!title)
      .join(' › ');
  });

  content = signal<CourseContent | null>(null);
  htmlBody = signal<SafeHtml>('');
  notesText = signal('');
  /** Read-only HTML for students / non-editors (avoids Quill startup cost). */
  notesHtml = signal<SafeHtml>('');
  notesDirty = signal(false);
  notesImportBusy = signal(false);
  notesImportError = signal('');
  notesEditorBusy = signal(false);
  /** Staff draft differs from the last published notes (students still see published). */
  hasUnpublishedNotes = signal(false);
  publishing = signal(false);
  tablePickerOpen = signal(false);
  tablePickerHoverRows = signal(3);
  tablePickerHoverCols = signal(3);
  tablePickerLeft = signal(0);
  tablePickerTop = signal(0);
  readonly tablePickerSizes = [1, 2, 3, 4, 5, 6, 7, 8];
  private skipTablePickerClose = false;
  /** When true, notes show a faithful Word (.docx) page preview instead of Quill. */
  notesWordPreview = signal(false);
  private notesDocxBuffer: ArrayBuffer | null = null;
  private static readonly NOTES_DOCX_PREFIX = '<!--vu-notes-docx-v1-->';
  private notesLoadToken = 0;
  slides = signal<CourseSlide[]>([]);
  videos = signal<CourseVideo[]>([]);
  documents = signal<CourseDocument[]>([]);
  liveSessions = signal<CourseLiveSession[]>([]);
  activeTab = signal<ReaderTab>('notes');
  loading = signal(true);
  saving = signal(false);
  saveError = signal('');
  error = signal<string | null>(null);

  enrollment = signal<CourseEnrollment | null>(null);
  enrollmentBusy = signal(false);
  enrollmentError = signal('');
  r2Enabled = signal(false);
  uploadBusy = signal(false);
  slideUploadBusy = signal(false);
  documentUploadBusy = signal(false);
  documentTitle = '';
  documentError = signal('');
  /** Short-lived signed playback URLs for R2 videos. */
  private r2PlaybackById = new Map<string, string>();
  /** Short-lived signed view URLs for R2 slides. */
  private r2SlideViewById = new Map<string, { url: string; format: string; safe?: SafeResourceUrl }>();
  private r2DocumentViewById = new Map<
    string,
    { url: string; format: string; safe?: SafeResourceUrl; html?: SafeHtml }
  >();
  activeSlides = signal<Set<string>>(new Set());
  activeDocuments = signal<Set<string>>(new Set());

  /** YouTube iframes that have been activated (play clicked). */
  activeVideos = signal<Set<string>>(new Set());
  /** YouTube / HTML5 videos currently paused via toolbar control. */
  pausedVideos = signal<Set<string>>(new Set());
  videoFullscreenId = signal<string | null>(null);
  slideFullscreenId = signal<string | null>(null);
  documentFullscreenId = signal<string | null>(null);
  notesFullscreen = signal(false);
  slideBuilderOpen = signal(false);
  slideBuilderBusy = signal(false);
  slideBuilderError = signal('');
  slideBuilderDeckTitle = '';
  slideBuilderSlides = signal<SlideBuilderCard[]>([]);
  /** Folded media cards (slides / documents / videos). */
  collapsedMediaIds = signal<Set<string>>(new Set());

  private ytFrames = new Map<string, HTMLIFrameElement>();
  private htmlVideoElements = new Map<string, HTMLVideoElement>();
  /** Stable embed URLs — recomputing in the template resets iframe src and reloads the player. */
  private youtubeEmbedById = new Map<string, SafeResourceUrl>();
  private notesQuill: QuillType | null = null;
  private notesSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private notesSyncing = false;
  private notesQuillLoading: Promise<typeof import('quill')> | null = null;

  slideTitle = '';
  slideUrl = '';
  videoTitle = '';
  videoUrl = '';
  liveSessionTitle = '';
  liveSessionUrl = '';
  liveSessionProvider: CourseLiveSession['provider'] = 'other';
  liveSessionScheduledAt = '';
  liveSessionDuration = 60;
  liveSessionNotes = '';
  mediaError = signal('');
  slideError = signal('');
  liveSessionError = signal('');

  /** Pending slide/video/document/live delete — shown in confirm modal before removal. */
  deleteConfirm = signal<{ kind: 'slide' | 'video' | 'document' | 'live'; id: string; title: string } | null>(null);

  readonly tabs: { id: ReaderTab; label: string; icon: string }[] = [
    { id: 'notes', label: 'Notes', icon: 'bi-journal-text' },
    { id: 'slides', label: 'Slides', icon: 'bi-easel2' },
    { id: 'documents', label: 'Documents', icon: 'bi-file-earmark-text' },
    { id: 'videos', label: 'Videos', icon: 'bi-camera-video' },
    { id: 'live', label: 'Live online lessons', icon: 'bi-broadcast' },
  ];

  constructor() {
    effect(() => {
      const id = this.contentId();
      this.mode();
      // Cancel any pending notes autosave so it cannot wipe the next lesson's media.
      this.clearNotesSaveTimer();
      this.activeTab.set('notes');
      this.activeVideos.set(new Set());
      this.pausedVideos.set(new Set());
      this.videoFullscreenId.set(null);
      this.slideFullscreenId.set(null);
      this.documentFullscreenId.set(null);
      this.notesFullscreen.set(false);
      this.collapsedMediaIds.set(new Set());
      this.ytFrames.clear();
      this.htmlVideoElements.clear();
      this.youtubeEmbedById.clear();
      this.r2PlaybackById.clear();
      this.r2SlideViewById.clear();
      this.r2DocumentViewById.clear();
      this.activeSlides.set(new Set());
      this.activeDocuments.set(new Set());
      this.notesDirty.set(false);
      this.notesImportError.set('');
      this.notesWordPreview.set(false);
      this.notesDocxBuffer = null;
      this.notesText.set('');
      this.notesHtml.set('');
      this.closeNotesTablePicker();
      // Quill host is torn down with the notes tab; drop the stale instance.
      this.notesQuill = null;
      this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.outlineCatsSub?.unsubscribe();
    this.clearNotesSaveTimer();
    this.closeNotesTablePicker();
    this.destroyNotesEditor();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.tablePickerOpen()) {
      this.closeNotesTablePicker();
      return;
    }
    if (this.slideBuilderOpen()) {
      this.closeSlideBuilder();
      return;
    }
    if (this.deleteConfirm()) {
      this.closeDeleteConfirm();
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
    this.videoFullscreenId.set(null);
    this.slideFullscreenId.set(null);
    this.documentFullscreenId.set(null);
    this.notesFullscreen.set(false);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.skipTablePickerClose) {
      this.skipTablePickerClose = false;
      return;
    }
    this.closeNotesTablePicker();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    this.closeNotesTablePicker();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    if (!document.fullscreenElement) {
      this.videoFullscreenId.set(null);
      this.slideFullscreenId.set(null);
      this.documentFullscreenId.set(null);
      this.notesFullscreen.set(false);
    }
  }

  blockMediaContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  setTab(tab: ReaderTab): void {
    const prev = this.activeTab();
    this.activeTab.set(tab);
    this.closeNotesTablePicker();
    this.mediaError.set('');
    this.slideError.set('');
    this.documentError.set('');
    // Notes panel is @if-gated — Quill's DOM is destroyed when leaving the tab.
    if (prev === 'notes' && tab !== 'notes') {
      this.notesQuill = null;
    }
    if (tab === 'notes') {
      setTimeout(() => {
        if (this.notesWordPreview()) {
          void this.mountNotesDocxPreview();
        } else {
          void this.ensureNotesEditor();
        }
      }, 0);
    }
  }

  get studentGoogleEmail(): string {
    return this.authService.currentUser?.email || '';
  }

  canManageCourseContent(): boolean {
    return this.authService.canManageCourseContent();
  }

  isSystemAdmin(): boolean {
    return this.authService.isSystemAdmin();
  }

  enroll(): void {
    const id = this.contentId();
    if (!id || this.enrollmentBusy()) return;
    this.enrollmentBusy.set(true);
    this.enrollmentError.set('');
    this.courseService.enroll(id).subscribe({
      next: (status) => {
        this.enrollment.set(status);
        this.enrollmentBusy.set(false);
      },
      error: (err) => {
        this.enrollmentError.set(err?.error?.message || err?.message || 'Enrollment failed.');
        this.enrollmentBusy.set(false);
      },
    });
  }

  unenroll(): void {
    const id = this.contentId();
    if (!id || this.enrollmentBusy()) return;
    this.enrollmentBusy.set(true);
    this.enrollmentError.set('');
    this.courseService.unenroll(id, '').subscribe({
      next: (status) => {
        this.enrollment.set(status);
        this.enrollmentBusy.set(false);
      },
      error: (err) => {
        this.enrollmentError.set(err?.error?.message || err?.message || 'Unenroll failed.');
        this.enrollmentBusy.set(false);
      },
    });
  }

  isVideoActive(id: string): boolean {
    return this.activeVideos().has(id);
  }

  isVideoPaused(id: string): boolean {
    return this.pausedVideos().has(id);
  }

  activateVideo(id: string): void {
    const video = this.videos().find((v) => v.id === id);
    if (!video) return;

    if (this.isR2Video(video)) {
      this.activateR2Video(video);
      return;
    }

    if (this.isYouTube(video.url) && !this.youtubeEmbedById.has(id)) {
      const src = this.toYouTubeEmbed(video.url, true);
      if (src) {
        this.youtubeEmbedById.set(id, this.sanitizer.bypassSecurityTrustResourceUrl(src));
      }
    }

    this.activeVideos.update((set) => new Set(set).add(id));
    this.pausedVideos.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  r2PlaybackSrc(id: string): string | null {
    return this.r2PlaybackById.get(id) ?? null;
  }

  isR2Video(video: CourseVideo): boolean {
    return video.provider === 'r2' || !!video.signedPlayback;
  }

  onR2FileSelected(event: Event): void {
    if (!this.canManageCourseContent()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const categoryId = this.content()?.categoryId || this.contentId();
    if (!categoryId) {
      this.mediaError.set('No lesson selected.');
      return;
    }
    if (!this.r2Enabled()) {
      this.mediaError.set('Cloudflare R2 is not configured on the server yet.');
      return;
    }
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|ogg|mov)$/i.test(file.name)) {
      this.mediaError.set('Please choose an MP4, WebM, or OGG video file.');
      return;
    }

    this.uploadBusy.set(true);
    this.mediaError.set('');
    const title = this.videoTitle.trim() || file.name;
    this.courseService.uploadR2Video(categoryId, file, title).subscribe({
      next: (uploaded) => {
        this.videos.update((list) => [...list, uploaded]);
        this.videoTitle = '';
        this.uploadBusy.set(false);
        this.markDraftDirty();
      },
      error: (err) => {
        this.mediaError.set(err?.error?.message || err?.message || 'Upload failed.');
        this.uploadBusy.set(false);
      },
    });
  }

  private activateR2Video(video: CourseVideo): void {
    const categoryId = this.content()?.categoryId || this.contentId();
    if (!categoryId) {
      this.mediaError.set('No lesson selected.');
      return;
    }

    this.mediaError.set('');
    this.courseService.getVideoPlayback(categoryId, video.id).subscribe({
      next: (playback) => {
        this.r2PlaybackById.set(video.id, playback.url);
        this.activeVideos.update((set) => new Set(set).add(video.id));
        this.pausedVideos.update((set) => {
          const next = new Set(set);
          next.delete(video.id);
          return next;
        });
      },
      error: (err) => {
        const status = err?.status;
        if (status === 403) {
          this.mediaError.set('Enroll in this course to watch protected videos.');
        } else {
          this.mediaError.set(err?.error?.message || err?.message || 'Could not start playback.');
        }
      },
    });
  }

  youtubeEmbedSrc(id: string): SafeResourceUrl | null {
    return this.youtubeEmbedById.get(id) ?? null;
  }

  activateDirectVideo(id: string, el: HTMLVideoElement): void {
    this.onHtmlVideoRef(id, el);
    this.activateVideo(id);
    void el.play();
  }

  toggleVideoPause(id: string): void {
    const video = this.videos().find((v) => v.id === id);
    if (!video) return;

    if (this.isYouTube(video.url)) {
      const paused = this.isVideoPaused(id);
      this.sendYtCommand(id, paused ? 'playVideo' : 'pauseVideo');
      this.setPaused(id, !paused);
      return;
    }

    if (this.isR2Video(video) || this.isDirectVideo(video.url)) {
      const el = this.htmlVideoElements.get(id);
      if (!el) return;
      if (el.paused) {
        void el.play();
        this.setPaused(id, false);
      } else {
        el.pause();
        this.setPaused(id, true);
      }
    }
  }

  toggleVideoFullscreen(id: string, stage: HTMLDivElement): void {
    if (document.fullscreenElement === stage) {
      void document.exitFullscreen();
      return;
    }

    void stage.requestFullscreen().then(() => {
      this.videoFullscreenId.set(id);
      this.slideFullscreenId.set(null);
      this.documentFullscreenId.set(null);
      this.notesFullscreen.set(false);
    });
  }

  toggleSlideFullscreen(id: string, stage: HTMLDivElement): void {
    if (document.fullscreenElement === stage) {
      void document.exitFullscreen();
      return;
    }

    void stage.requestFullscreen().then(() => {
      this.slideFullscreenId.set(id);
      this.videoFullscreenId.set(null);
      this.documentFullscreenId.set(null);
      this.notesFullscreen.set(false);
    });
  }

  toggleNotesFullscreen(stage: HTMLElement): void {
    if (document.fullscreenElement === stage) {
      void document.exitFullscreen();
      return;
    }

    const enter = (): void => {
      this.notesFullscreen.set(true);
      this.videoFullscreenId.set(null);
      this.slideFullscreenId.set(null);
      this.documentFullscreenId.set(null);
    };

    const request =
      stage.requestFullscreen?.bind(stage) ||
      (stage as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen?.bind(
        stage
      );

    if (request) {
      void Promise.resolve(request()).then(enter).catch(enter);
      return;
    }

    enter();
  }

  toggleDocumentFullscreen(id: string, stage: HTMLDivElement): void {
    if (document.fullscreenElement === stage) {
      void document.exitFullscreen();
      return;
    }

    const enterFullscreen = (): void => {
      void stage.requestFullscreen().then(() => {
        this.documentFullscreenId.set(id);
        this.videoFullscreenId.set(null);
        this.slideFullscreenId.set(null);
        this.notesFullscreen.set(false);
      });
    };

    if (this.isDocumentActive(id) && (this.r2DocumentSrc(id) || this.r2DocumentHtml(id))) {
      enterFullscreen();
      return;
    }

    const doc = this.documents().find((d) => d.id === id);
    if (!doc) return;
    this.openR2Document(doc, enterFullscreen);
  }

  showSlideFullscreen(slide: CourseSlide): boolean {
    if (this.isR2Slide(slide)) {
      return (
        this.isSlideActive(slide.id) &&
        this.r2SlideFormat(slide.id) === 'pdf' &&
        !!this.r2SlideSrc(slide.id)
      );
    }
    return !!this.slideEmbedUrl(slide.url);
  }

  showDocumentFullscreen(doc: CourseDocument): boolean {
    if (this.isDocumentActive(doc.id)) {
      return !!(this.r2DocumentSrc(doc.id) || this.r2DocumentHtml(doc.id));
    }
    const format = (doc.fileFormat || '').toLowerCase();
    return ['pdf', 'txt', 'word', 'excel', 'pptx', 'csv', 'rtf', 'odt', 'odp'].includes(format);
  }

  isMediaCollapsed(id: string): boolean {
    return this.collapsedMediaIds().has(id);
  }

  toggleMediaCollapsed(id: string): void {
    const willCollapse = !this.collapsedMediaIds().has(id);
    this.collapsedMediaIds.update((set) => {
      const next = new Set(set);
      if (willCollapse) next.add(id);
      else next.delete(id);
      return next;
    });

    if (
      willCollapse &&
      (this.slideFullscreenId() === id ||
        this.documentFullscreenId() === id ||
        this.videoFullscreenId() === id)
    ) {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
      this.slideFullscreenId.set(null);
      this.documentFullscreenId.set(null);
      this.videoFullscreenId.set(null);
    }
  }

  onYtFrameLoad(id: string, iframe: HTMLIFrameElement): void {
    this.ytFrames.set(id, iframe);
  }

  onHtmlVideoRef(id: string, el: HTMLVideoElement): void {
    this.htmlVideoElements.set(id, el);
  }

  showVideoControls(video: CourseVideo): boolean {
    if (this.isR2Video(video) || this.isYouTube(video.url) || this.isDirectVideo(video.url)) {
      return this.isVideoActive(video.id);
    }
    return false;
  }

  isYouTube(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes('youtube.com') || lower.includes('youtu.be');
  }

  addSlide(): void {
    const url = this.slideUrl.trim();
    if (!url) {
      this.slideError.set('Paste a Google Slides or Google Drive share link.');
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      this.slideError.set('Enter a valid Google Slides or Drive URL.');
      return;
    }

    const embed = this.toGoogleSlideEmbed(parsed.href);
    if (!embed) {
      this.slideError.set(
        'Use a Google Slides link (docs.google.com/presentation/...) or a Drive file link (drive.google.com/file/...).'
      );
      return;
    }

    const title = this.slideTitle.trim() || `Presentation ${this.slides().length + 1}`;
    this.slides.update((list) => [
      ...list,
      {
        id: `slide-${Date.now()}`,
        title,
        url: parsed.href,
        provider: embed.provider,
      },
    ]);
    this.slideTitle = '';
    this.slideUrl = '';
    this.slideError.set('');
    this.markDraftDirty();
  }

  isR2Slide(slide: CourseSlide): boolean {
    return slide.provider === 'r2' || !!slide.signedPlayback;
  }

  isSlideActive(id: string): boolean {
    return this.activeSlides().has(id);
  }

  r2SlideSrc(id: string): SafeResourceUrl | null {
    return this.r2SlideViewById.get(id)?.safe ?? null;
  }

  r2SlideFormat(id: string): string {
    return this.r2SlideViewById.get(id)?.format ?? 'other';
  }

  r2SlideRawUrl(id: string): string | null {
    return this.r2SlideViewById.get(id)?.url ?? null;
  }

  onR2SlideSelected(event: Event): void {
    if (!this.canManageCourseContent()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const categoryId = this.content()?.categoryId || this.contentId();
    if (!categoryId) {
      this.slideError.set('No lesson selected.');
      return;
    }
    if (!this.r2Enabled()) {
      this.slideError.set('Cloudflare R2 is not configured on the server yet.');
      return;
    }
    if (!/\.(pdf|ppt|pptx|ppsx)$/i.test(file.name) && !/pdf|powerpoint|presentation/i.test(file.type)) {
      this.slideError.set('Please choose a PDF or PowerPoint file (.pdf, .ppt, .pptx).');
      return;
    }

    this.slideUploadBusy.set(true);
    this.slideError.set('');
    const title = this.slideTitle.trim() || file.name;
    this.courseService.uploadR2Slide(categoryId, file, title).subscribe({
      next: (uploaded) => {
        this.slides.update((list) => [...list, uploaded]);
        this.slideTitle = '';
        this.slideUploadBusy.set(false);
        this.markDraftDirty();
      },
      error: (err) => {
        this.slideError.set(err?.error?.message || err?.message || 'Upload failed.');
        this.slideUploadBusy.set(false);
      },
    });
  }

  openSlideBuilder(): void {
    if (!this.canManageCourseContent()) return;
    this.slideBuilderDeckTitle = this.content()?.title?.trim() || 'Lesson presentation';
    this.slideBuilderSlides.set([this.newBuilderSlide()]);
    this.slideBuilderError.set('');
    this.slideBuilderBusy.set(false);
    this.slideBuilderOpen.set(true);
  }

  closeSlideBuilder(): void {
    if (this.slideBuilderBusy()) return;
    this.slideBuilderOpen.set(false);
    this.slideBuilderError.set('');
  }

  addBuilderSlide(): void {
    this.slideBuilderSlides.update((list) => [...list, this.newBuilderSlide()]);
  }

  removeBuilderSlide(id: string): void {
    this.slideBuilderSlides.update((list) => (list.length <= 1 ? list : list.filter((slide) => slide.id !== id)));
  }

  updateBuilderSlide(id: string, field: 'title' | 'bullets', value: string): void {
    this.slideBuilderSlides.update((list) =>
      list.map((slide) => (slide.id === id ? { ...slide, [field]: value } : slide))
    );
  }

  onBuilderImage(id: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.slideBuilderError.set('Please choose an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      this.slideBuilderSlides.update((list) =>
        list.map((slide) =>
          slide.id === id ? { ...slide, imageName: file.name, imageDataUrl: dataUrl } : slide
        )
      );
    };
    reader.readAsDataURL(file);
  }

  clearBuilderImage(id: string): void {
    this.slideBuilderSlides.update((list) =>
      list.map((slide) =>
        slide.id === id ? { ...slide, imageName: undefined, imageDataUrl: undefined } : slide
      )
    );
  }

  async exportSlideBuilder(): Promise<void> {
    if (!this.canManageCourseContent() || this.slideBuilderBusy()) return;
    const deckTitle = this.slideBuilderDeckTitle.trim() || 'Lesson presentation';
    const slides = this.slideBuilderSlides();
    if (!slides.length) {
      this.slideBuilderError.set('Add at least one slide.');
      return;
    }

    this.slideBuilderBusy.set(true);
    this.slideBuilderError.set('');
    try {
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();
      pptx.author = 'Veneranda University';
      pptx.title = deckTitle;
      for (const card of slides) {
        const slide = pptx.addSlide();
        slide.addText(card.title.trim() || `Slide`, {
          x: 0.5,
          y: 0.35,
          w: 9.2,
          h: 0.8,
          fontSize: 28,
          bold: true,
          color: '1A1F36',
          fontFace: 'Calibri',
        });
        const bullets = card.bullets
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({ text: line, options: { bullet: true, breakLine: true } }));
        if (bullets.length) {
          slide.addText(bullets, {
            x: 0.5,
            y: 1.3,
            w: card.imageDataUrl ? 5.4 : 9.2,
            h: 4.6,
            fontSize: 18,
            color: '334155',
            fontFace: 'Calibri',
            valign: 'top',
          });
        }
        if (card.imageDataUrl) {
          slide.addImage({
            data: card.imageDataUrl,
            x: 6.2,
            y: 1.4,
            w: 3.4,
            h: 3.4,
          });
        }
      }

      const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
      const fileName = `${deckTitle.replace(/[^\w\s-]+/g, '').trim() || 'presentation'}.pptx`;
      const file = new File([blob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      const categoryId = this.content()?.categoryId || this.contentId();
      if (this.r2Enabled() && categoryId) {
        this.courseService.uploadR2Slide(categoryId, file, deckTitle).subscribe({
          next: (uploaded) => {
            this.slides.update((list) => [...list, uploaded]);
            this.slideBuilderBusy.set(false);
            this.slideBuilderOpen.set(false);
            this.activeTab.set('slides');
            this.markDraftDirty();
          },
          error: (err) => {
            this.slideBuilderError.set(err?.error?.message || err?.message || 'Could not save the presentation.');
            this.slideBuilderBusy.set(false);
          },
        });
        return;
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      this.slideBuilderBusy.set(false);
      this.slideBuilderOpen.set(false);
    } catch (err) {
      this.slideBuilderError.set(err instanceof Error ? err.message : 'Could not create the PowerPoint file.');
      this.slideBuilderBusy.set(false);
    }
  }

  private newBuilderSlide(): SlideBuilderCard {
    return {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: '',
      bullets: '',
    };
  }

  openR2Slide(slide: CourseSlide): void {
    const categoryId = this.content()?.categoryId || this.contentId();
    if (!categoryId) {
      this.slideError.set('No lesson selected.');
      return;
    }

    this.slideError.set('');
    this.courseService.getSlideView(categoryId, slide.id).subscribe({
      next: (view) => {
        const entry: { url: string; format: string; safe?: SafeResourceUrl } = {
          url: view.url,
          format: view.format || 'other',
        };
        if (view.format === 'pdf') {
          entry.safe = this.sanitizer.bypassSecurityTrustResourceUrl(view.url);
        }
        this.r2SlideViewById.set(slide.id, entry);
        this.activeSlides.update((set) => new Set(set).add(slide.id));
      },
      error: (err) => {
        if (err?.status === 403) {
          this.slideError.set('Enroll in this course to view protected slides.');
        } else {
          this.slideError.set(err?.error?.message || err?.message || 'Could not open presentation.');
        }
      },
    });
  }

  isR2Document(doc: CourseDocument): boolean {
    return doc.provider === 'r2' || !!doc.signedPlayback;
  }

  isDocumentActive(id: string): boolean {
    return this.activeDocuments().has(id);
  }

  r2DocumentSrc(id: string): SafeResourceUrl | null {
    return this.r2DocumentViewById.get(id)?.safe ?? null;
  }

  r2DocumentHtml(id: string): SafeHtml | null {
    return this.r2DocumentViewById.get(id)?.html ?? null;
  }

  r2DocumentFormat(id: string): string {
    return this.r2DocumentViewById.get(id)?.format ?? 'other';
  }

  r2DocumentRawUrl(id: string): string | null {
    return this.r2DocumentViewById.get(id)?.url ?? null;
  }

  documentFormatLabel(format?: string): string {
    switch ((format || '').toLowerCase()) {
      case 'pdf':
        return 'PDF';
      case 'word':
        return 'Word';
      case 'excel':
        return 'Excel';
      case 'pptx':
        return 'PowerPoint';
      case 'txt':
        return 'Text';
      case 'csv':
        return 'CSV';
      case 'rtf':
        return 'RTF';
      case 'odt':
        return 'OpenDocument';
      case 'odp':
        return 'ODP';
      default:
        return (format || 'File').toUpperCase();
    }
  }

  private officeOnlineEmbedUrl(fileUrl: string): string {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private async prepareDocumentViewer(
    fileUrl: string,
    format: string
  ): Promise<{ safe?: SafeResourceUrl; html?: SafeHtml }> {
    const f = (format || 'other').toLowerCase();

    if (f === 'pdf') {
      return { safe: this.sanitizer.bypassSecurityTrustResourceUrl(fileUrl) };
    }

    if (f === 'txt' || f === 'csv') {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Could not download document (${response.status}).`);
        }
        const text = await response.text();
        const html = `<pre class="document-text-pre">${this.escapeHtml(text)}</pre>`;
        return { html: this.sanitizer.bypassSecurityTrustHtml(html) };
      } catch {
        return { safe: this.sanitizer.bypassSecurityTrustResourceUrl(fileUrl) };
      }
    }

    // Word, Excel, PowerPoint, and related Office formats in their native online viewer.
    return {
      safe: this.sanitizer.bypassSecurityTrustResourceUrl(this.officeOnlineEmbedUrl(fileUrl)),
    };
  }

  onR2DocumentSelected(event: Event): void {
    if (!this.canManageCourseContent()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const categoryId = this.content()?.categoryId || this.contentId();
    if (!categoryId) {
      this.documentError.set('No lesson selected.');
      return;
    }
    if (!this.r2Enabled()) {
      this.documentError.set('Cloudflare R2 is not configured on the server yet.');
      return;
    }
    if (
      !/\.(pdf|doc|docx|ppt|pptx|ppsx|xls|xlsx|odt|odp|rtf|txt|csv)$/i.test(file.name) &&
      !/pdf|word|excel|sheet|presentation|text|rtf|csv/i.test(file.type)
    ) {
      this.documentError.set('Please choose a supported document (PDF, Word, Excel, PowerPoint, TXT, CSV, …).');
      return;
    }

    this.documentUploadBusy.set(true);
    this.documentError.set('');
    const title = this.documentTitle.trim() || file.name;
    this.courseService.uploadR2Document(categoryId, file, title).subscribe({
      next: (uploaded) => {
        this.documents.update((list) => [...list, uploaded]);
        this.documentTitle = '';
        this.documentUploadBusy.set(false);
        this.markDraftDirty();
      },
      error: (err) => {
        this.documentError.set(err?.error?.message || err?.message || 'Upload failed.');
        this.documentUploadBusy.set(false);
      },
    });
  }

  openR2Document(doc: CourseDocument, onReady?: () => void): void {
    const categoryId = this.content()?.categoryId || this.contentId();
    if (!categoryId) {
      this.documentError.set('No lesson selected.');
      return;
    }

    this.documentError.set('');
    this.courseService.getDocumentView(categoryId, doc.id).subscribe({
      next: (view) => {
        const format = view.format || doc.fileFormat || 'other';
        void this.prepareDocumentViewer(view.url, format)
          .then((viewer) => {
            this.r2DocumentViewById.set(doc.id, {
              url: view.url,
              format,
              safe: viewer.safe,
              html: viewer.html,
            });
            this.activeDocuments.update((set) => new Set(set).add(doc.id));
            if (viewer.safe || viewer.html) {
              onReady?.();
            }
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'Could not open document.';
            this.documentError.set(message);
            // Still expose a download fallback.
            this.r2DocumentViewById.set(doc.id, { url: view.url, format });
            this.activeDocuments.update((set) => new Set(set).add(doc.id));
          });
      },
      error: (err) => {
        if (err?.status === 403) {
          this.documentError.set('Enroll in this course to view protected documents.');
        } else {
          this.documentError.set(err?.error?.message || err?.message || 'Could not open document.');
        }
      },
    });
  }

  removeDocument(id: string): void {
    this.documents.update((list) => list.filter((d) => d.id !== id));
    this.r2DocumentViewById.delete(id);
    this.activeDocuments.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    if (this.documentFullscreenId() === id) {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
      this.documentFullscreenId.set(null);
    }
    this.markDraftDirty();
  }

  requestDeleteDocument(doc: CourseDocument): void {
    if (!this.canManageCourseContent()) return;
    this.deleteConfirm.set({ kind: 'document', id: doc.id, title: doc.title });
  }

  removeSlide(id: string): void {
    this.slides.update((list) => list.filter((s) => s.id !== id));
    this.r2SlideViewById.delete(id);
    this.activeSlides.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    if (this.slideFullscreenId() === id) {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
      this.slideFullscreenId.set(null);
    }
    this.markDraftDirty();
  }

  requestDeleteSlide(slide: CourseSlide): void {
    if (!this.canManageCourseContent()) return;
    this.deleteConfirm.set({ kind: 'slide', id: slide.id, title: slide.title });
  }

  requestDeleteVideo(video: CourseVideo): void {
    if (!this.canManageCourseContent()) return;
    this.deleteConfirm.set({ kind: 'video', id: video.id, title: video.title });
  }

  requestDeleteLiveSession(session: CourseLiveSession): void {
    if (!this.canManageCourseContent()) return;
    this.deleteConfirm.set({ kind: 'live', id: session.id, title: session.title });
  }

  closeDeleteConfirm(): void {
    this.deleteConfirm.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteConfirm();
    if (!target) return;

    if (target.kind === 'slide') {
      this.removeSlide(target.id);
    } else if (target.kind === 'document') {
      this.removeDocument(target.id);
    } else if (target.kind === 'live') {
      this.removeLiveSession(target.id);
    } else {
      this.removeVideo(target.id);
    }
    this.closeDeleteConfirm();
  }

  deleteConfirmHeading(): string {
    const target = this.deleteConfirm();
    if (target?.kind === 'slide') return 'Delete presentation?';
    if (target?.kind === 'document') return 'Delete document?';
    if (target?.kind === 'live') return 'Delete live session?';
    return 'Delete video?';
  }

  deleteConfirmMessage(): string {
    const target = this.deleteConfirm();
    if (!target) return '';
    const label =
      target.kind === 'slide'
        ? 'presentation'
        : target.kind === 'document'
          ? 'document'
          : target.kind === 'live'
            ? 'live session'
            : 'video';
    return `Are you sure you want to delete "${target.title}"? This ${label} will be removed from the lesson.`;
  }

  slideEmbedUrl(url: string): SafeResourceUrl | null {
    const embed = this.toGoogleSlideEmbed(url);
    return embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed.src) : null;
  }

  addVideo(): void {
    const url = this.videoUrl.trim();
    if (!url) {
      this.mediaError.set('Please enter a video URL.');
      return;
    }
    try {
      new URL(url);
    } catch {
      this.mediaError.set('Enter a valid video URL (e.g. YouTube or MP4 link).');
      return;
    }

    const title = this.videoTitle.trim() || `Video ${this.videos().length + 1}`;
    const provider = this.isYouTube(url) ? 'youtube' : /\.(mp4|webm|ogg)(\?|$)/i.test(url) ? 'mp4' : 'other';
    this.videos.update((list) => [
      ...list,
      { id: `video-${Date.now()}`, title, url, provider },
    ]);
    this.videoTitle = '';
    this.videoUrl = '';
    this.mediaError.set('');
    this.markDraftDirty();
  }

  addLiveSession(): void {
    const url = this.liveSessionUrl.trim();
    if (!url) {
      this.liveSessionError.set('Please enter a meeting link.');
      return;
    }
    try {
      new URL(url);
    } catch {
      this.liveSessionError.set('Enter a valid meeting URL (Zoom, Google Meet, Teams, etc.).');
      return;
    }

    const title = this.liveSessionTitle.trim() || `Live session ${this.liveSessions().length + 1}`;
    const provider = this.liveSessionProvider || this.detectLiveProvider(url);
    const scheduledAt = this.liveSessionScheduledAt.trim()
      ? new Date(this.liveSessionScheduledAt).toISOString()
      : null;
    const durationMinutes = Number.isFinite(this.liveSessionDuration) && this.liveSessionDuration > 0
      ? Math.round(this.liveSessionDuration)
      : 60;
    const notes = this.liveSessionNotes.trim() || null;

    this.liveSessions.update((list) => [
      ...list,
      {
        id: `live-${Date.now()}`,
        title,
        url,
        provider,
        scheduledAt,
        durationMinutes,
        notes,
      },
    ]);
    this.liveSessionTitle = '';
    this.liveSessionUrl = '';
    this.liveSessionProvider = 'other';
    this.liveSessionScheduledAt = '';
    this.liveSessionDuration = 60;
    this.liveSessionNotes = '';
    this.liveSessionError.set('');
    this.markDraftDirty();
  }

  removeLiveSession(id: string): void {
    this.liveSessions.update((list) => list.filter((session) => session.id !== id));
    this.markDraftDirty();
  }

  liveSessionStatus(session: CourseLiveSession): 'upcoming' | 'live' | 'past' | 'open' {
    if (!session.scheduledAt) return 'open';
    const start = new Date(session.scheduledAt).getTime();
    if (Number.isNaN(start)) return 'open';
    const now = Date.now();
    const durationMs = (session.durationMinutes ?? 60) * 60_000;
    if (now < start) return 'upcoming';
    if (now <= start + durationMs) return 'live';
    return 'past';
  }

  liveSessionStatusLabel(session: CourseLiveSession): string {
    const status = this.liveSessionStatus(session);
    if (status === 'upcoming') return 'Upcoming';
    if (status === 'live') return 'Live now';
    if (status === 'past') return 'Ended';
    return 'Open session';
  }

  liveProviderLabel(provider?: CourseLiveSession['provider']): string {
    switch (provider) {
      case 'zoom':
        return 'Zoom';
      case 'google-meet':
        return 'Google Meet';
      case 'microsoft-teams':
        return 'Microsoft Teams';
      default:
        return 'Online meeting';
    }
  }

  formatLiveSchedule(session: CourseLiveSession): string {
    if (!session.scheduledAt) return 'No fixed schedule';
    const date = new Date(session.scheduledAt);
    if (Number.isNaN(date.getTime())) return 'No fixed schedule';
    const duration = session.durationMinutes ?? 60;
    return `${date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })} · ${duration} min`;
  }

  private detectLiveProvider(url: string): CourseLiveSession['provider'] {
    const lower = url.toLowerCase();
    if (lower.includes('zoom.us')) return 'zoom';
    if (lower.includes('meet.google.com')) return 'google-meet';
    if (lower.includes('teams.microsoft.com') || lower.includes('teams.live.com')) return 'microsoft-teams';
    return 'other';
  }

  removeVideo(id: string): void {
    this.videos.update((list) => list.filter((v) => v.id !== id));
    this.activeVideos.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    this.pausedVideos.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    this.ytFrames.delete(id);
    this.htmlVideoElements.delete(id);
    this.youtubeEmbedById.delete(id);
    this.r2PlaybackById.delete(id);
    if (this.videoFullscreenId() === id) {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
      this.videoFullscreenId.set(null);
    }
    this.markDraftDirty();
  }

  saveNotes(): void {
    if (!this.canManageCourseContent()) return;
    this.clearNotesSaveTimer();
    this.persistLesson(true);
  }

  private markDraftDirty(): void {
    this.notesDirty.set(true);
  }

  publishNotes(): void {
    if (!this.canManageCourseContent()) return;
    this.closeNotesTablePicker();
    const publish = () => this.finishPublish();
    if (this.notesDirty()) {
      this.clearNotesSaveTimer();
      this.persistLesson(true, publish);
      return;
    }
    publish();
  }

  hoverTableSize(rows: number, cols: number): void {
    this.tablePickerHoverRows.set(rows);
    this.tablePickerHoverCols.set(cols);
  }

  insertNotesTable(rows: number, cols: number): void {
    const r = Math.min(12, Math.max(1, Math.round(rows) || 1));
    const c = Math.min(12, Math.max(1, Math.round(cols) || 1));
    this.notesQuill?.focus();
    const table = this.notesQuill?.getModule('table') as { insertTable?: (rows: number, cols: number) => void } | undefined;
    table?.insertTable?.(r, c);
    this.closeNotesTablePicker();
  }

  closeNotesTablePicker(): void {
    this.tablePickerOpen.set(false);
  }

  private openNotesTablePicker(): void {
    this.skipTablePickerClose = true;
    const opening = !this.tablePickerOpen();
    this.tablePickerOpen.set(opening);
    if (!opening) return;
    this.tablePickerHoverRows.set(3);
    this.tablePickerHoverCols.set(3);
    const button = document.querySelector('.notes-editor-shell button.ql-table') as HTMLElement | null;
    const rect = button?.getBoundingClientRect();
    const width = 196;
    const height = 220;
    const left = Math.max(8, Math.min((rect?.left ?? 16), window.innerWidth - width - 8));
    const top = Math.max(8, Math.min((rect?.bottom ?? 48) + 6, window.innerHeight - height - 8));
    this.tablePickerLeft.set(left);
    this.tablePickerTop.set(top);
  }

  private finishPublish(): void {
    const categoryId = this.content()?.categoryId || this.contentId();
    if (!categoryId) return;
    const token = this.notesLoadToken;
    this.publishing.set(true);
    this.saveError.set('');
    this.courseService.publishLesson(categoryId).subscribe({
      next: (lesson) => {
        if (token !== this.notesLoadToken) return;
        this.publishing.set(false);
        this.hasUnpublishedNotes.set(!!lesson.hasUnpublishedNotes);
        this.notesDirty.set(false);
      },
      error: (err) => {
        if (token !== this.notesLoadToken) return;
        this.publishing.set(false);
        this.saveError.set(err?.error?.message || err?.message || 'Could not publish notes. Please try again.');
      },
    });
  }

  onNotesWordSelected(event: Event): void {
    if (!this.canManageCourseContent()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!/\.docx$/i.test(file.name)) {
      this.notesImportError.set('Please choose a .docx Word document (legacy .doc is not supported).');
      return;
    }

    this.notesImportBusy.set(true);
    this.notesImportError.set('');
    void this.importWordIntoNotes(file)
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Could not import Word document.';
        this.notesImportError.set(message);
      })
      .finally(() => this.notesImportBusy.set(false));
  }

  private async importWordIntoNotes(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer.byteLength) {
      throw new Error('The Word document appears to be empty.');
    }

    // Keep the original bytes so we can render pages/headers/layout faithfully.
    this.notesDocxBuffer = arrayBuffer.slice(0);
    this.notesText.set(this.encodeNotesDocx(this.notesDocxBuffer));
    this.notesWordPreview.set(true);
    this.notesDirty.set(true);
    this.destroyNotesEditor();

    setTimeout(() => void this.mountNotesDocxPreview(), 0);
  }

  editImportedNotesAsText(): void {
    if (!this.canManageCourseContent()) return;
    const buffer = this.notesDocxBuffer;
    if (!buffer) {
      this.notesWordPreview.set(false);
      setTimeout(() => void this.ensureNotesEditor(), 0);
      return;
    }

    this.notesImportBusy.set(true);
    this.notesImportError.set('');
    void (async () => {
      const mammoth = await import('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer.slice(0) });
      const html = (result.value || '').trim() || '<p></p>';
      this.notesDocxBuffer = null;
      this.notesWordPreview.set(false);
      this.notesText.set(html);
      this.notesDirty.set(true);
      setTimeout(() => {
        void this.ensureNotesEditor();
      }, 0);
    })()
      .catch((err: unknown) => {
        this.notesImportError.set(
          err instanceof Error ? err.message : 'Could not convert Word document for editing.'
        );
      })
      .finally(() => this.notesImportBusy.set(false));
  }

  private async mountNotesDocxPreview(): Promise<void> {
    if (!this.notesWordPreview() || !this.notesDocxBuffer) return;
    const host = document.getElementById('notes-docx-host');
    if (!host) return;

    host.innerHTML = '';
    host.classList.add('is-rendering');
    try {
      const { renderAsync } = await import('docx-preview');
      await renderAsync(this.notesDocxBuffer.slice(0), host, undefined, {
        className: 'vu-notes-docx',
        inWrapper: true,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        ignoreWidth: false,
        ignoreHeight: false,
        useBase64URL: true,
        experimental: true,
      });
    } finally {
      host.classList.remove('is-rendering');
    }
  }

  private encodeNotesDocx(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return CourseReader.NOTES_DOCX_PREFIX + btoa(binary);
  }

  private decodeNotesDocx(value: string): ArrayBuffer | null {
    if (!value?.startsWith(CourseReader.NOTES_DOCX_PREFIX)) return null;
    try {
      const binary = atob(value.slice(CourseReader.NOTES_DOCX_PREFIX.length));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    } catch {
      return null;
    }
  }

  private applyLoadedNotes(raw: string): void {
    const docx = this.decodeNotesDocx(raw || '');
    if (docx) {
      this.destroyNotesEditor();
      this.notesDocxBuffer = docx;
      this.notesText.set(raw);
      this.notesHtml.set('');
      this.notesWordPreview.set(true);
      this.notesDirty.set(false);
      return;
    }
    this.notesDocxBuffer = null;
    this.notesWordPreview.set(false);
    this.notesText.set(raw || '');
    this.notesDirty.set(false);
    this.updateNotesHtmlView(raw || '');
  }

  private updateNotesHtmlView(raw: string): void {
    if (this.canManageCourseContent()) {
      this.notesHtml.set('');
      return;
    }
    const html = this.notesToEditorHtml(raw);
    this.notesHtml.set(
      this.sanitizer.bypassSecurityTrustHtml(
        html || '<p class="notes-empty">No notes for this lesson yet.</p>'
      )
    );
  }

  private async ensureNotesEditor(): Promise<void> {
    if (this.activeTab() !== 'notes' || this.loading() || this.notesWordPreview()) return;
    // Students/viewers get plain HTML — Quill is only for content managers.
    if (!this.canManageCourseContent()) {
      this.updateNotesHtmlView(this.notesText());
      return;
    }

    const host = document.getElementById('lesson-notes-quill');
    if (!host) return;

    if (this.notesQuill) {
      this.syncNotesEditorFromModel();
      return;
    }

    const token = this.notesLoadToken;
    this.notesEditorBusy.set(true);
    try {
      if (!this.notesQuillLoading) {
        this.notesQuillLoading = import('quill');
      }
      const { default: Quill } = await this.notesQuillLoading;
      if (token !== this.notesLoadToken || this.notesWordPreview() || !this.canManageCourseContent()) {
        return;
      }
      const mount = document.getElementById('lesson-notes-quill');
      if (!mount || this.notesQuill) {
        if (this.notesQuill) this.syncNotesEditorFromModel();
        return;
      }

      mount.innerHTML = '';
      this.notesQuill = new Quill(mount, {
        theme: 'snow',
        placeholder: 'Write the main content and notes for this lesson…',
        modules: {
          table: true,
          history: true,
          toolbar: {
            container: [
              [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
              [{ header: [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ script: 'sub' }, { script: 'super' }],
              [{ color: [] }, { background: [] }],
              [{ list: 'ordered' }, { list: 'bullet' }],
              [{ indent: '-1' }, { indent: '+1' }],
              [{ align: [] }],
              ['blockquote', 'code-block'],
              ['link', 'image', 'table'],
              ['undo', 'redo'],
              ['clean'],
            ],
            handlers: {
              undo: () => {
                const history = this.notesQuill?.getModule('history') as { undo?: () => void } | undefined;
                history?.undo?.();
              },
              redo: () => {
                const history = this.notesQuill?.getModule('history') as { redo?: () => void } | undefined;
                history?.redo?.();
              },
              table: () => this.openNotesTablePicker(),
              image: () => this.pickNotesImage(),
            },
          },
        },
      });
      this.styleNotesToolbar();

      this.syncNotesEditorFromModel();
      this.notesQuill.on('text-change', () => {
        if (this.notesSyncing || !this.notesQuill) return;
        const html = this.normalizeNotesHtml(this.notesQuill.root.innerHTML);
        this.notesText.set(html);
        this.notesDirty.set(true);
      });
    } finally {
      if (token === this.notesLoadToken) {
        this.notesEditorBusy.set(false);
      }
    }
  }

  private pickNotesImage(): void {
    if (!this.notesQuill) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file || !this.notesQuill) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl || !this.notesQuill) return;
        const range = this.notesQuill.getSelection(true);
        this.notesQuill.insertEmbed(range?.index ?? 0, 'image', dataUrl, 'user');
        this.notesQuill.setSelection((range?.index ?? 0) + 1, 0, 'silent');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  private styleNotesToolbar(): void {
    const toolbar = this.notesQuill?.getModule('toolbar') as { container?: HTMLElement } | undefined;
    const root = toolbar?.container;
    if (!root) return;
    const undo = root.querySelector('button.ql-undo');
    const redo = root.querySelector('button.ql-redo');
    if (undo && !undo.querySelector('i')) undo.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
    if (redo && !redo.querySelector('i')) redo.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    const table = root.querySelector('button.ql-table');
    if (table && !table.getAttribute('title')) table.setAttribute('title', 'Insert table');
  }

  private syncNotesEditorFromModel(): void {
    if (!this.notesQuill) return;
    const host = document.getElementById('lesson-notes-quill');
    if (!host || !host.isConnected) {
      this.notesQuill = null;
      return;
    }
    const html = this.notesToEditorHtml(this.notesText());
    const current = this.normalizeNotesHtml(this.notesQuill.root.innerHTML);
    if (current === this.normalizeNotesHtml(html)) return;
    this.notesSyncing = true;
    try {
      this.notesQuill.setContents([]);
      this.notesQuill.clipboard.dangerouslyPasteHTML(html || '');
    } finally {
      // Defer so Quill's text-change cannot schedule an autosave for a sync.
      queueMicrotask(() => {
        this.notesSyncing = false;
      });
    }
  }

  private destroyNotesEditor(): void {
    this.notesQuill = null;
    const shell = document.querySelector('.notes-editor-shell');
    if (shell) {
      shell.innerHTML = '<div id="lesson-notes-quill" class="notes-quill-host"></div>';
    }
  }

  private notesToEditorHtml(value: string): string {
    if (!value) return '';
    if (/<[a-z][\s\S]*>/i.test(value)) return value;
    return value
      .split(/\n{2,}/)
      .map((block) => `<p>${this.escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  private normalizeNotesHtml(html: string): string {
    let out = (html || '').trim();
    if (!out) return '';
    // Undo accidental double-encoding from cross-client edits.
    for (let i = 0; i < 3; i++) {
      const next = out
        .replace(/&amp;amp;/g, '&amp;')
        .replace(/&amp;lt;/g, '&lt;')
        .replace(/&amp;gt;/g, '&gt;')
        .replace(/&amp;quot;/g, '&quot;')
        .replace(/&amp;nbsp;/g, '&nbsp;');
      if (next === out) break;
      out = next;
    }
    out = out.replace(/<br\s*\/?>/gi, '<br>');
    out = out.replace(/>\s+</g, '><').trim();
    if (!out || out === '<p><br></p>' || out === '<p></p>') return '';
    return out;
  }

  private clearNotesSaveTimer(): void {
    if (this.notesSaveTimer) {
      clearTimeout(this.notesSaveTimer);
      this.notesSaveTimer = null;
    }
  }

  embedUrl(url: string, autoplay = false): SafeResourceUrl | null {
    const yt = this.toYouTubeEmbed(url, autoplay);
    if (yt) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(yt);
    }
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    return null;
  }

  isDirectVideo(url: string): boolean {
    return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
  }

  private persistLesson(fromNotes = false, after?: () => void): void {
    const categoryId = this.content()?.categoryId || this.contentId();
    if (!categoryId) return;
    // Never persist while a different lesson is still loading in.
    if (this.loading()) return;

    if (this.notesQuill && !this.notesSyncing && !this.notesWordPreview()) {
      const host = document.getElementById('lesson-notes-quill');
      if (host?.isConnected) {
        this.notesText.set(this.normalizeNotesHtml(this.notesQuill.root.innerHTML));
      }
    } else if (this.notesWordPreview() && this.notesDocxBuffer) {
      this.notesText.set(this.encodeNotesDocx(this.notesDocxBuffer));
    }

    const saveForId = categoryId;
    const saveToken = this.notesLoadToken;
    this.saving.set(true);
    this.saveError.set('');

    this.courseService
      .saveLesson(saveForId, {
        notesBody: this.notesText(),
        slides: this.slides(),
        videos: this.videos(),
        documents: this.documents(),
        liveSessions: this.liveSessions(),
      })
      .subscribe({
        next: (lesson) => {
          // Ignore stale responses from a previous lesson.
          if (saveToken !== this.notesLoadToken) return;
          this.saving.set(false);
          if (saveForId !== (this.content()?.categoryId || this.contentId())) return;
          this.slides.set(lesson.slides ?? []);
          this.videos.set(lesson.videos ?? []);
          this.documents.set(lesson.documents ?? []);
          this.liveSessions.set(lesson.liveSessions ?? []);
          if (fromNotes) {
            this.notesDirty.set(false);
          }
          this.hasUnpublishedNotes.set(!!lesson.hasUnpublishedNotes);
          after?.();
        },
        error: (err) => {
          if (saveToken !== this.notesLoadToken) return;
          this.saving.set(false);
          this.saveError.set(
            err?.error?.message || err?.message || 'Could not save lesson content. Please try again.'
          );
        },
      });
  }

  private toGoogleSlideEmbed(
    url: string
  ): { src: string; provider: 'google-slides' | 'google-drive' } | null {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host.includes('docs.google.com') && parsed.pathname.includes('/presentation/')) {
        const match = parsed.pathname.match(/\/presentation\/d\/([^/]+)/);
        if (match?.[1]) {
          return {
            provider: 'google-slides',
            src: `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`,
          };
        }
      }

      if (host.includes('drive.google.com')) {
        const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
        if (fileMatch?.[1]) {
          return {
            provider: 'google-drive',
            src: `https://drive.google.com/file/d/${fileMatch[1]}/preview`,
          };
        }
        const openId = parsed.searchParams.get('id');
        if (openId) {
          return {
            provider: 'google-drive',
            src: `https://drive.google.com/file/d/${openId}/preview`,
          };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  private toYouTubeEmbed(url: string, autoplay = false): string | null {
    try {
      const parsed = new URL(url);
      let videoId: string | null = null;

      if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.replace('/', '') || null;
      } else if (parsed.hostname.includes('youtube.com')) {
        videoId = parsed.searchParams.get('v');
      }

      if (!videoId) return null;

      const params = new URLSearchParams({
        autoplay: autoplay ? '1' : '0',
        rel: '0',
        modestbranding: '1',
        fs: '0',
        disablekb: '1',
        playsinline: '1',
        iv_load_policy: '3',
        enablejsapi: '1',
      });

      if (typeof window !== 'undefined') {
        params.set('origin', window.location.origin);
      }

      return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
    } catch {
      return null;
    }
  }

  private load(id: string): void {
    const loadToken = ++this.notesLoadToken;
    this.clearNotesSaveTimer();
    this.loading.set(true);
    this.saving.set(false);
    this.publishing.set(false);
    this.hasUnpublishedNotes.set(false);
    this.closeNotesTablePicker();
    this.error.set(null);
    this.mediaError.set('');
    this.slideError.set('');
    this.saveError.set('');
    this.enrollmentError.set('');
    this.enrollment.set(null);
    this.courseService.isR2Enabled().subscribe({
      next: (status) => this.r2Enabled.set(!!status.enabled),
      error: () => this.r2Enabled.set(false),
    });

    if (!id) {
      this.content.set(null);
      this.slides.set([]);
      this.videos.set([]);
      this.documents.set([]);
      this.liveSessions.set([]);
      this.error.set('No content selected.');
      this.loading.set(false);
      return;
    }

    this.outlineCatsSub?.unsubscribe();
    this.outlineCatsSub = this.courseService.getCategories().subscribe({
      next: (categories) => {
        if (loadToken !== this.notesLoadToken) return;
        this.outlineCategories.set(categories);
      },
      error: () => {
        if (loadToken !== this.notesLoadToken) return;
        this.outlineCategories.set([]);
      },
    });

    this.courseService.getContent(id).subscribe({
      next: (data) => {
        if (loadToken !== this.notesLoadToken) return;
        this.content.set(data);
        this.slides.set([...(data.slides || [])]);
        this.videos.set([...(data.videos || [])]);
        this.documents.set([...(data.documents || [])]);
        this.liveSessions.set([...(data.liveSessions || [])]);
        this.applyLoadedNotes(data.body || '');
        this.hasUnpublishedNotes.set(!!data.hasUnpublishedNotes);
        this.loadEnrollment(id);

        if (this.mode() === 'file' && data.fileUrl) {
          this.loadFile(data.fileUrl, loadToken);
          return;
        }

        if (data.body && !this.notesWordPreview()) {
          this.htmlBody.set(this.sanitizer.bypassSecurityTrustHtml(data.body));
        } else {
          this.htmlBody.set('');
        }
        this.loading.set(false);
        if (this.activeTab() === 'notes') {
          setTimeout(() => {
            if (loadToken !== this.notesLoadToken) return;
            if (this.notesWordPreview()) {
              void this.mountNotesDocxPreview();
            } else {
              void this.ensureNotesEditor();
            }
          }, 0);
        }
      },
      error: (err) => {
        if (loadToken !== this.notesLoadToken) return;
        if (err?.status === 402) {
          this.router.navigate(['/checkout', id]);
          return;
        }
        this.error.set(err?.error?.message || err?.message || 'Failed to load content.');
        this.loading.set(false);
      },
    });
  }

  private loadEnrollment(categoryId: string): void {
    this.courseService.getEnrollment(categoryId).subscribe({
      next: (status) => this.enrollment.set(status),
      error: () => this.enrollment.set(null),
    });
  }

  private loadFile(path: string, loadToken = this.notesLoadToken): void {
    this.courseService.loadHtmlFile(path).subscribe({
      next: (html) => {
        if (loadToken !== this.notesLoadToken) return;
        this.htmlBody.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.applyLoadedNotes(html);
        this.loading.set(false);
        if (this.activeTab() === 'notes') {
          setTimeout(() => {
            if (loadToken !== this.notesLoadToken) return;
            if (this.notesWordPreview()) {
              void this.mountNotesDocxPreview();
            } else {
              void this.ensureNotesEditor();
            }
          }, 0);
        }
      },
      error: () => {
        if (loadToken !== this.notesLoadToken) return;
        this.error.set('Could not load the requested file.');
        this.loading.set(false);
      },
    });
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
  }

  private setPaused(id: string, paused: boolean): void {
    this.pausedVideos.update((set) => {
      const next = new Set(set);
      if (paused) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private sendYtCommand(id: string, func: 'playVideo' | 'pauseVideo'): void {
    const iframe = this.ytFrames.get(id);
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: '' }), '*');
  }
}
