/**
 * Course outline data model.
 *
 * Categories without a parentId are top-level sections.
 * A leaf item has no children and exposes contentId/contentPath so the reader
 * can load the material to display in the main content area.
 */
export interface CourseCategory {
  id: string;
  title: string;
  parentId?: string | null;
  orderIndex: number;
  icon?: string;
  description?: string;
  contentId?: string | null;
  contentPath?: string | null;
  googleGroupEmail?: string | null;
  isPublished?: boolean;
  nodeKind?: 'PROGRAMME' | 'YEAR' | 'SEMESTER' | 'UNIT' | 'OUTLINE' | string;
  priceAmount?: number | null;
  currency?: string;
  createdBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
  affiliatedInstitution?: string | null;
  programmeCode?: string | null;
  abbreviation?: string | null;
  /** Programme card / hero image URL or data URL. */
  coverImageUrl?: string | null;
}

export interface CourseContent {
  id: string;
  categoryId: string;
  title: string;
  description?: string;
  body: string;
  fileUrl?: string | null;
  fileType?: 'html' | 'markdown' | 'pdf' | 'video' | 'audio' | 'external' | null;
  orderIndex: number;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
  slides?: CourseSlide[];
  videos?: CourseVideo[];
  documents?: CourseDocument[];
  liveSessions?: CourseLiveSession[];
  /** Staff-only: draft notes differ from the last published version. */
  hasUnpublishedNotes?: boolean;
}

export interface CourseSlide {
  id: string;
  title: string;
  url: string;
  provider?: 'google-slides' | 'google-drive' | 'r2' | 'other';
  notes?: string;
  /** Cloudflare R2 — view via signed URL API, not raw url. */
  signedPlayback?: boolean;
}

export interface CourseDocument {
  id: string;
  title: string;
  url: string;
  provider?: 'r2' | 'link' | 'other';
  fileFormat?: string;
  signedPlayback?: boolean;
}

export interface CourseVideo {
  id: string;
  title: string;
  url: string;
  provider?: 'youtube' | 'mp4' | 'r2' | 'other';
  /** Cloudflare R2 — play via signed URL API, not raw url. */
  signedPlayback?: boolean;
}

export interface CourseLiveSession {
  id: string;
  title: string;
  url: string;
  provider?: 'zoom' | 'google-meet' | 'microsoft-teams' | 'other';
  /** ISO-8601 schedule start, optional */
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface CourseLessonPayload {
  notesBody: string;
  slides: CourseSlide[];
  videos: CourseVideo[];
  documents: CourseDocument[];
  liveSessions: CourseLiveSession[];
}

/** Enrollment against the course root + Google Group sync status. */
export interface CourseEnrollment {
  id?: string;
  categoryId: string;
  categoryTitle?: string;
  googleGroupEmail?: string | null;
  enrollmentStatus: string;
  groupSyncStatus: string;
  groupSyncError?: string | null;
  enrolledAt?: string | null;
  groupSyncedAt?: string | null;
  enrolled: boolean;
}

export interface CourseAccess {
  categoryId: string;
  categoryTitle?: string;
  nodeKind?: string;
  enrolled: boolean;
  paid: boolean;
  canAccess: boolean;
  canManage: boolean;
  amount?: number | null;
  currency?: string;
}

export interface CourseSubscription {
  id?: string;
  categoryId: string;
  categoryTitle?: string;
  nodeKind?: string;
  paymentStatus: string;
  amount?: number | null;
  currency?: string;
  paymentMethod?: string;
  paid: boolean;
  paidAt?: string | null;
  expiresAt?: string | null;
}

/**
 * Hierarchical node used by the sidebar renderer.
 */
export interface CourseNode extends CourseCategory {
  children: CourseNode[];
  isExpanded?: boolean;
}
