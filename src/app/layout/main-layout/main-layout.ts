import { Component, HostListener, inject, signal, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet, Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CourseService } from '../../core/services/course.service';
import { LayoutSettingsService } from '../../core/services/layout-settings.service';
import { CourseCategory, CourseNode } from '../../core/models/course.model';
import { programmeHeading } from '../../core/utils/programme.util';

export type AppearanceMode = 'split' | 'dark' | 'light';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  permission?: string;
}

interface ToolbarNotice {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: string;
  tone: 'info' | 'success' | 'warning';
  read: boolean;
}

interface ToolbarMessage {
  id: string;
  from: string;
  initials: string;
  preview: string;
  time: string;
  read: boolean;
}

@Component({
  selector: 'app-main-layout',
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private courseService = inject(CourseService);
  private router = inject(Router);
  private breakpoint = inject(BreakpointObserver);
  private layoutSettings = inject(LayoutSettingsService);

  readonly isMobile = toSignal(
    this.breakpoint.observe('(max-width: 768px)').pipe(map((state) => state.matches)),
    {
      initialValue:
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false,
    }
  );
  mobileDrawerOpen = signal(false);

  /** split = dark sidebar + light main, dark = all dark, light = all light */
  appearance = signal<AppearanceMode>('split');
  /** Full sidebar vs icon-only rail. Sidenav stays open either way. */
  sidebarCollapsed = signal<boolean>(false);
  /** Hover overlay open when compact hover mode is on. */
  sidebarHovered = signal(false);

  hoverSidebar = this.layoutSettings.hoverSidebar;

  /**
   * Unit that owns the Course Outline list. Persists across sidebar collapse/expand
   * and in-layout routes (settings, etc.) so the outline does not jump back to programme.
   */
  private outlineFocusUnitId = signal<string | null>(this.readStoredOutlineUnit());

  sidebarWidth = signal<number>(270);
  private readonly collapsedWidth = 72;
  private minSidebarWidth = 200;
  private maxSidebarWidth = 500;
  private isResizing = false;

  currentUser = this.authService.currentUser$;

  courseTree = signal<CourseNode[]>([]);
  allCategories = signal<CourseCategory[]>([]);
  loadingCourseTree = signal(true);
  activeContentId = signal<string | null>(null);
  contextMenuNode = signal<CourseNode | null>(null);
  sidebarSearch = signal('');
  /** Folder ids the user has opened. Survives tree rebuilds from selection or add-child. */
  private expandedNodeIds = signal<Set<string>>(new Set());
  nodeMenuOpen = signal(false);
  nodeMenuPos = signal({ top: 0, left: 0 });
  profileMenuOpen = signal(false);
  profileMenuPos = signal({ top: 0, right: 16 });
  notificationsOpen = signal(false);
  notificationsPos = signal({ top: 0, right: 16 });
  messagesOpen = signal(false);
  messagesPos = signal({ top: 0, right: 16 });
  appearanceOpen = signal(false);
  appearancePos = signal({ top: 0, right: 16 });

  appearanceOptions: { id: AppearanceMode; label: string; description: string }[] = [
    {
      id: 'split',
      label: 'Classic',
      description: 'Dark sidebar, light content',
    },
    {
      id: 'dark',
      label: 'Dark',
      description: 'All dark interface',
    },
    {
      id: 'light',
      label: 'Light',
      description: 'All light interface',
    },
  ];

  notifications = signal<ToolbarNotice[]>([
    {
      id: 'n1',
      title: 'New course published',
      body: 'Module 1: Foundations is now available to students.',
      time: '2m ago',
      icon: 'bi-journal-check',
      tone: 'success',
      read: false,
    },
    {
      id: 'n2',
      title: 'Assignment reminder',
      body: 'Assignment 1 is due tomorrow at 5:00 PM.',
      time: '1h ago',
      icon: 'bi-alarm',
      tone: 'warning',
      read: false,
    },
    {
      id: 'n3',
      title: 'System update',
      body: 'Course Portal maintenance completed successfully.',
      time: 'Yesterday',
      icon: 'bi-info-circle',
      tone: 'info',
      read: true,
    },
  ]);

  messages = signal<ToolbarMessage[]>([
    {
      id: 'm1',
      from: 'Dr. Amina Okello',
      initials: 'AO',
      preview: 'Please review the updated Orientation outline before Friday.',
      time: '12m ago',
      read: false,
    },
    {
      id: 'm2',
      from: 'Registrar Office',
      initials: 'RO',
      preview: 'Enrollment confirmation for the new cohort is ready.',
      time: '3h ago',
      read: false,
    },
    {
      id: 'm3',
      from: 'Support Desk',
      initials: 'SD',
      preview: 'Your ticket about content loading has been resolved.',
      time: 'Mon',
      read: true,
    },
  ]);

  unreadNotifications = computed(() => this.notifications().filter((n) => !n.read).length);
  unreadMessages = computed(() => this.messages().filter((m) => !m.read).length);

  selectedCourseNode = computed(() => {
    const activeId = this.activeContentId();
    if (!activeId) return null;

    const find = (nodes: CourseNode[]): CourseNode | null => {
      for (const node of nodes) {
        if ((node.contentId || node.id) === activeId) return node;
        const child = find(node.children || []);
        if (child) return child;
      }
      return null;
    };

    return find(this.courseTree());
  });

  private categoryById = computed(() => {
    const map = new Map<string, CourseCategory>();
    for (const category of this.allCategories()) {
      if (category.id) map.set(category.id, category);
    }
    return map;
  });

  selectedCategory = computed(() => {
    const activeId = this.activeContentId();
    if (!activeId) return null;
    const exact = this.categoryById().get(activeId);
    if (exact) return exact;
    return this.allCategories().find((category) => category.contentId === activeId) ?? null;
  });

  /** Ancestors of a category, root first (programme → year → semester). */
  private ancestorsOf(category: CourseCategory | null): CourseCategory[] {
    if (!category) return [];
    const byId = this.categoryById();
    const chain: CourseCategory[] = [];
    const seen = new Set<string>();
    let parentId = category.parentId || null;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      chain.unshift(parent);
      parentId = parent.parentId || null;
    }
    return chain;
  }

  selectedUnitNode = computed(() => {
    const current = this.selectedCategory();
    if (!current) return this.selectedCourseNode();
    if (current.nodeKind === 'UNIT') return current;
    const fromRoot = [...this.ancestorsOf(current), current];
    return [...fromRoot].reverse().find((node) => node.nodeKind === 'UNIT') ?? current;
  });

  selectedCourseTitle = computed(() => programmeHeading(this.selectedUnitNode()) || 'Select a course');

  toolbarBreadcrumb = computed(() => this.ancestorsOf(this.selectedUnitNode()));

  /** Replaces the old “Course outline” line under the unit name. */
  unitBreadcrumb = computed(() => {
    const titles = this.toolbarBreadcrumb()
      .map((node) => node.title?.trim())
      .filter((title): title is string => !!title);
    if (titles.length) return titles.join(' › ');

    const unit = this.selectedUnitNode();
    const activeId = unit?.id || this.activeContentId();
    if (!activeId) return '';
    const path = this.findNodePath(this.courseTree(), activeId);
    if (path.length < 2) return '';
    const unitIndex = path.findIndex((node) => node.id === unit?.id);
    const cut = unitIndex > 0 ? unitIndex : path.length - 1;
    return path
      .slice(0, cut)
      .map((node) => node.title?.trim())
      .filter((title): title is string => !!title)
      .join(' › ');
  });

  showCourseModal = signal(false);
  savingCourse = signal(false);
  courseModalParent = signal<CourseNode | null>(null);
  courseModalEditNode = signal<CourseNode | null>(null);
  courseFormTitle = '';
  courseFormDescription = '';
  courseFormParentId = signal('');
  courseFormError = signal('');
  parentPickerOpen = signal(false);
  parentPickerQuery = signal('');
  parentPickerDropUp = signal(false);

  courseModalHeading = computed(() => {
    if (this.courseModalEditNode()) return 'Edit outline item';
    const parent = this.courseModalParent();
    if (parent?.nodeKind === 'UNIT') return 'Add outline item';
    return parent ? 'Add child item' : 'New course section';
  });

  courseModalSubtitle = computed(() => {
    const editing = this.courseModalEditNode();
    if (editing) {
      return `Update “${editing.title}”.`;
    }
    const parent = this.courseModalParent();
    if (parent?.nodeKind === 'UNIT') {
      return `Add an outline item to “${parent.title}”.`;
    }
    return parent
      ? `Create a subsection under “${parent.title}”.`
      : 'Add a top-level section to the course outline.';
  });

  courseModalSaveLabel = computed(() => {
    if (this.courseModalEditNode()) return 'Save changes';
    const parent = this.courseModalParent();
    if (parent?.nodeKind === 'UNIT') return 'Add item';
    return parent ? 'Add child' : 'Create section';
  });

  /** Course unit plus outline sections under it, excluding this item and its descendants. */
  outlineParentOptions = computed(() => {
    const editing = this.courseModalEditNode();
    if (!editing?.id) return [] as { id: string; label: string }[];

    const root = this.outlineRootFor(editing);
    const blocked = this.descendantIdsIncludingSelf(editing.id);
    const options: { id: string; label: string }[] = [];
    const seen = new Set<string>();

    const add = (id: string | null | undefined, label: string) => {
      if (!id || seen.has(id) || id === editing.id) return;
      seen.add(id);
      options.push({ id, label });
    };

    if (root?.id) {
      add(root.id, root.title || 'Course unit');
      this.collectOutlineParentOptions(root.id, blocked, add);
    }

    const parentId = editing.parentId;
    if (parentId && !seen.has(parentId) && parentId !== editing.id) {
      const parent = this.categoryById().get(parentId);
      add(parentId, parent?.title || 'Current parent');
    }

    return options;
  });

  selectedParentLabel = computed(() => {
    const id = this.courseFormParentId();
    return this.outlineParentOptions().find((option) => option.id === id)?.label || 'Select a parent item';
  });

  filteredOutlineParentOptions = computed(() => {
    const query = this.parentPickerQuery().trim().toLowerCase();
    const options = this.outlineParentOptions();
    if (!query) return options;
    return options.filter((option) => option.label.toLowerCase().includes(query));
  });

  courseModalIcon = computed(() => (this.courseModalEditNode() ? 'bi-pencil-square' : 'bi-journal-plus'));

  /** Width reserved for the page (does not grow when hover overlay expands). */
  contentSidebarWidth = computed(() => {
    // Mobile drawer overlays content — reserve no sidebar gutter.
    if (this.isMobile()) return 0;
    if (this.hoverSidebar()) return this.collapsedWidth;
    return this.sidebarCollapsed() ? this.collapsedWidth : this.sidebarWidth();
  });

  /** Visible sidenav width, including overlay expansion. */
  sidenavDisplayWidth = computed(() => {
    // Full-bleed mobile drawer; CSS also forces 100% width.
    if (this.isMobile()) {
      return typeof window !== 'undefined' ? window.innerWidth : 390;
    }
    if (this.hoverSidebar() && this.sidebarHovered()) return this.sidebarWidth();
    return this.contentSidebarWidth();
  });

  /** Icon-only rail (no labels). */
  iconRail = computed(() => {
    if (this.isMobile()) return false;
    if (this.hoverSidebar()) return !this.sidebarHovered();
    return this.sidebarCollapsed();
  });

  hoverOverlayOpen = computed(
    () => this.hoverSidebar() && !this.isMobile() && this.sidebarHovered()
  );

  private hoverLeaveTimer: ReturnType<typeof setTimeout> | null = null;

  sidenavOpened = computed(() => (this.isMobile() ? this.mobileDrawerOpen() : true));
  sidenavMode = computed<'over' | 'side'>(() => (this.isMobile() ? 'over' : 'side'));
  burgerLabel = computed(() => {
    if (this.isMobile()) {
      return this.mobileDrawerOpen() ? 'Close course outline' : 'Open course outline';
    }
    if (this.hoverSidebar()) {
      return 'Sidebar expands on hover';
    }
    return this.sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar';
  });

  filteredCourseTree = computed(() => this.filterCourseTree(this.courseTree(), this.sidebarSearch()));

  routeUrl = signal('');

  activeUnitNode = computed(() => {
    const activeId = this.activeContentId();
    if (!activeId || !this.routeUrl().includes('/course')) return null;
    return this.unitNodeFor(activeId);
  });

  /** Unit used for the sidebar outline — focused unit, else route/selection. */
  outlineUnitNode = computed(() => {
    const focusedId = this.outlineFocusUnitId();
    if (focusedId) {
      const focused = this.categoryById().get(focusedId);
      if (focused?.nodeKind === 'UNIT') return focused as CourseNode;
    }
    const active = this.activeUnitNode();
    if (active?.nodeKind === 'UNIT') return active;
    const selected = this.selectedUnitNode();
    if (selected?.nodeKind === 'UNIT') return selected as CourseNode;
    return null;
  });

  programmeNode = computed(() => {
    const start = this.outlineUnitNode() ?? this.selectedUnitNode() ?? this.selectedCategory();
    if (start) {
      const ancestors = this.ancestorsOf(start);
      const chain = [...ancestors, start];
      const programme = chain.find((node) => node.nodeKind === 'PROGRAMME');
      if (programme) return programme;
      if (ancestors[0]) return ancestors[0];
    }
    const activeId = this.activeContentId();
    if (!activeId) return null;
    const path = this.findNodePath(this.courseTree(), activeId);
    return path.find((node) => node.nodeKind === 'PROGRAMME') ?? path[0] ?? null;
  });

  programmeName = computed(() => programmeHeading(this.programmeNode()) || 'Programme');

  /** Year › Semester › Unit shown under the programme name in the sidebar. */
  sidebarContextBreadcrumb = computed(() => {
    const unit = this.outlineUnitNode() ?? this.selectedUnitNode();
    if (!unit) return '';

    const parts = this.ancestorsOf(unit)
      .filter((node) => node.nodeKind === 'YEAR' || node.nodeKind === 'SEMESTER')
      .map((node) => node.title?.trim())
      .filter((title): title is string => !!title);

    if (unit.nodeKind === 'UNIT') {
      const unitTitle = unit.title?.trim();
      if (unitTitle) parts.push(unitTitle);
    }

    return parts.join(' › ');
  });

  sidebarProgrammeTooltip = computed(() => {
    const context = this.sidebarContextBreadcrumb();
    const name = this.programmeName();
    return context ? `${name} · ${context}` : name;
  });

  /** Programme page — pick a year / semester / unit to load into the outline. */
  sidebarProgrammeLink = computed(() => {
    const programme = this.programmeNode();
    if (programme?.id) return ['/programmes', programme.id] as string[];
    return '/explore';
  });

  displayCourseTree = computed(() => {
    const unit = this.outlineUnitNode();
    if (unit?.id) {
      return this.filterCourseTree(this.childrenOf(unit.id), this.sidebarSearch());
    }
    return this.filteredCourseTree();
  });

  filteredAdminNavItems = computed(() => {
    const q = this.sidebarSearch().trim().toLowerCase();
    if (!q) return this.adminNavItems;
    return this.adminNavItems.filter((item) => item.label.toLowerCase().includes(q));
  });

  /** Operational nav is the course outline; ISP/hotspot modules removed. */
  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
  ];

  adminNavItems: NavItem[] = [
    { label: 'Users', icon: 'manage_accounts', route: '/admin/users', permission: 'user:read' },
    { label: 'Roles', icon: 'shield', route: '/admin/roles', permission: 'role:read' },
    { label: 'Permissions', icon: 'lock', route: '/admin/permissions', permission: 'role:read' },
    { label: 'Audit Logs', icon: 'history', route: '/admin/audit', permission: 'audit:read' },
    { label: 'Settings', icon: 'settings', route: '/admin/settings', permission: 'setting:manage' },
  ];

  constructor() {
    effect(() => {
      if (this.isMobile()) {
        this.sidebarCollapsed.set(false);
        this.sidebarHovered.set(false);
      } else {
        this.mobileDrawerOpen.set(false);
      }
    });
  }

  ngOnInit(): void {
    document.documentElement.classList.add('app-shell');
    document.body.classList.add('app-shell');
    this.appearance.set(this.resolveInitialAppearance());
    this.applyAppearance(this.appearance());

    const savedWidth = localStorage.getItem('course_sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed)) {
        this.sidebarWidth.set(Math.max(this.minSidebarWidth, Math.min(this.maxSidebarWidth, parsed)));
      }
    }

    this.loadCourseTree();
    this.routeUrl.set(this.router.url);
    this.trackActiveContent();
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.routeUrl.set(event.urlAfterRedirects);
        this.trackActiveContent();
        if (this.isMobile()) {
          this.mobileDrawerOpen.set(false);
        }
        this.collapseHoverSidebar();
      }
    });
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('app-shell');
    document.body.classList.remove('app-shell');
    this.clearHoverLeaveTimer();
  }

  private outlineRootFor(node: CourseCategory): CourseCategory | null {
    const active = this.activeUnitNode();
    if (active?.id && active.id !== node.id) {
      return this.categoryById().get(active.id) ?? active;
    }

    const unit = this.owningUnitOf(node);
    if (unit?.id && unit.id !== node.id) return unit;

    if (node.parentId) {
      return this.categoryById().get(node.parentId) ?? null;
    }

    const path = this.findNodePath(this.courseTree(), node.id);
    if (path.length >= 2) {
      return path[path.length - 2];
    }
    return this.selectedUnitNode() ?? null;
  }

  private collectOutlineParentOptions(
    parentId: string,
    blocked: Set<string>,
    add: (id: string, label: string) => void
  ): void {
    const children = this.allCategories()
      .filter((category) => category.parentId === parentId && !blocked.has(category.id))
      .filter((category) => this.isOutlineLike(category.nodeKind))
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    for (const child of children) {
      add(child.id, child.title || 'Untitled');
      this.collectOutlineParentOptions(child.id, blocked, add);
    }
  }

  private isOutlineLike(kind?: string | null): boolean {
    const value = (kind || 'OUTLINE').toUpperCase();
    return value === 'OUTLINE';
  }

  private owningUnitOf(node: CourseCategory): CourseCategory | null {
    if ((node.nodeKind || '').toUpperCase() === 'UNIT') return node;
    const chain = [...this.ancestorsOf(node), node];
    return [...chain].reverse().find((item) => (item.nodeKind || '').toUpperCase() === 'UNIT') ?? null;
  }

  private descendantIdsIncludingSelf(id: string): Set<string> {
    const blocked = new Set<string>([id]);
    const walk = (parentId: string) => {
      for (const child of this.allCategories()) {
        if (child.parentId === parentId && !blocked.has(child.id)) {
          blocked.add(child.id);
          walk(child.id);
        }
      }
    };
    walk(id);
    return blocked;
  }

  /** Outline items attached to a parent, from the flat category list. */
  private childrenOf(parentId: string): CourseNode[] {
    return this.allCategories()
      .filter((category) => category.parentId === parentId)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((category) => ({
        ...category,
        children: this.childrenOf(category.id),
      }));
  }

  private findNodePath(nodes: CourseNode[], targetId: string): CourseNode[] {
    const walk = (list: CourseNode[], trail: CourseNode[]): CourseNode[] | null => {
      for (const node of list) {
        const next = [...trail, node];
        if ((node.contentId || node.id) === targetId || node.id === targetId) return next;
        const child = walk(node.children || [], next);
        if (child) return child;
      }
      return null;
    };
    return walk(nodes, []) ?? [];
  }

  private resolveInitialAppearance(): AppearanceMode {
    const savedAppearance = localStorage.getItem('isp_appearance');
    if (savedAppearance === 'split' || savedAppearance === 'dark' || savedAppearance === 'light') {
      return savedAppearance;
    }
    // Migrate legacy theme key
    const legacy = localStorage.getItem('isp_theme');
    if (legacy === 'dark') return 'dark';
    if (legacy === 'light') return 'light';
    return 'split';
  }

  startResize(event: MouseEvent): void {
    event.preventDefault();
    this.isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const moveHandler = (e: MouseEvent) => {
      if (!this.isResizing) return;
      const newWidth = Math.max(this.minSidebarWidth, Math.min(this.maxSidebarWidth, e.clientX));
      this.sidebarWidth.set(newWidth);
    };

    const upHandler = () => {
      this.isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('course_sidebar_width', this.sidebarWidth().toString());
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
  }

  private loadCourseTree(expandNodeId?: string | null): void {
    const showSpinner = this.allCategories().length === 0;
    if (showSpinner) this.loadingCourseTree.set(true);
    this.courseService.getCategories().subscribe({
      next: (categories) => {
        this.allCategories.set(categories);
        this.courseTree.set(this.courseService.buildTree(categories));
        if (expandNodeId) {
          this.expandNodes([expandNodeId]);
          this.expandAncestorsOf(expandNodeId);
        }
        this.pinOutlineUnitFor(this.activeContentId());
        this.loadingCourseTree.set(false);
      },
      error: () => {
        this.allCategories.set([]);
        this.courseTree.set([]);
        this.loadingCourseTree.set(false);
      },
    });
  }

  isNodeExpanded(node: CourseNode): boolean {
    return this.expandedNodeIds().has(node.id);
  }

  private expandNodes(ids: Array<string | null | undefined>): void {
    const extra = ids.filter((id): id is string => !!id);
    if (!extra.length) return;
    this.expandedNodeIds.update((current) => {
      let changed = false;
      const next = new Set(current);
      for (const id of extra) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }

  private expandAncestorsOf(nodeId: string): void {
    const byId = this.categoryById();
    const ids: string[] = [];
    const seen = new Set<string>();
    let current = byId.get(nodeId) ?? this.allCategories().find((category) => category.contentId === nodeId);
    while (current?.parentId && !seen.has(current.parentId)) {
      seen.add(current.parentId);
      ids.push(current.parentId);
      current = byId.get(current.parentId);
    }
    this.expandNodes(ids);
  }

  /** Keep the sidebar expansion in sync with the current route. */
  private trackActiveContent(): void {
    const url = this.router.url;
    const match = url.match(/\/course(?:\/file)?\/([^/]+)/);
    if (match) {
      this.activeContentId.set(match[1]);
      this.expandAncestorsOf(match[1]);
      this.pinOutlineUnitFor(match[1]);
      this.expandSidebarForCourse();
    }
  }

  /** Open the sidebar at full width when viewing course content. */
  private expandSidebarForCourse(): void {
    if (this.isMobile()) return;
    this.sidebarCollapsed.set(false);
    this.sidebarWidth.set(this.maxSidebarWidth);
    if (this.hoverSidebar()) {
      this.sidebarHovered.set(true);
    }
    try {
      localStorage.setItem('course_sidebar_width', this.maxSidebarWidth.toString());
    } catch {
      /* ignore quota / private mode */
    }
  }

  private readStoredOutlineUnit(): string | null {
    try {
      return sessionStorage.getItem('isp_outline_unit');
    } catch {
      return null;
    }
  }

  private rememberOutlineUnit(unitId: string | null): void {
    this.outlineFocusUnitId.set(unitId);
    try {
      if (unitId) sessionStorage.setItem('isp_outline_unit', unitId);
      else sessionStorage.removeItem('isp_outline_unit');
    } catch {
      /* ignore quota / private mode */
    }
  }

  private unitNodeFor(activeId: string): CourseNode | null {
    const path = this.findNodePath(this.courseTree(), activeId);
    if (path.length) {
      return [...path].reverse().find((node) => node.nodeKind === 'UNIT') ?? path[path.length - 1];
    }
    const category = this.unitCategoryFor(activeId);
    return category ? (category as CourseNode) : null;
  }

  private unitCategoryFor(activeId: string): CourseCategory | null {
    const byId = this.categoryById();
    let current: CourseCategory | null =
      byId.get(activeId) ??
      this.allCategories().find((category) => category.contentId === activeId || category.id === activeId) ??
      null;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.nodeKind === 'UNIT') return current;
      current = current.parentId ? (byId.get(current.parentId) ?? null) : null;
    }
    return null;
  }

  private pinOutlineUnitFor(activeId: string | null): void {
    if (!activeId) return;
    const unit = this.unitCategoryFor(activeId);
    if (unit?.id) this.rememberOutlineUnit(unit.id);
  }

  toggleNode(node: CourseNode): void {
    this.expandedNodeIds.update((current) => {
      const next = new Set(current);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }

  isLeaf(node: CourseNode): boolean {
    return !node.children || node.children.length === 0;
  }

  selectLeaf(node: CourseNode): void {
    if (!this.isLeaf(node)) return;

    const id = node.contentId || node.id;
    this.activeContentId.set(id);
    this.closeMobileDrawer();
    this.expandSidebarForCourse();

    if (node.contentPath) {
      this.router.navigate(['/course/file', id]);
    } else {
      this.router.navigate(['/course', id]);
    }
  }

  openNodeMenu(event: MouseEvent, node: CourseNode): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeToolbarPanels();
    this.contextMenuNode.set(node);

    const menuWidth = 180;
    const menuHeight = 160;
    const padding = 8;
    let left = event.clientX;
    let top = event.clientY;

    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }
    if (top + menuHeight > window.innerHeight - padding) {
      top = window.innerHeight - menuHeight - padding;
    }

    this.nodeMenuPos.set({ top: Math.max(padding, top), left: Math.max(padding, left) });
    this.nodeMenuOpen.set(true);
  }

  closeNodeMenu(): void {
    this.nodeMenuOpen.set(false);
    this.contextMenuNode.set(null);
    this.collapseHoverSidebar();
  }

  toggleProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (this.profileMenuOpen()) {
      this.closeToolbarPanels();
      return;
    }
    this.closeToolbarPanels();
    this.profileMenuPos.set(this.menuPosFromEvent(event));
    this.profileMenuOpen.set(true);
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    if (this.notificationsOpen()) {
      this.closeToolbarPanels();
      return;
    }
    this.closeToolbarPanels();
    this.notificationsPos.set(this.menuPosFromEvent(event));
    this.notificationsOpen.set(true);
  }

  toggleMessages(event: MouseEvent): void {
    event.stopPropagation();
    if (this.messagesOpen()) {
      this.closeToolbarPanels();
      return;
    }
    this.closeToolbarPanels();
    this.messagesPos.set(this.menuPosFromEvent(event));
    this.messagesOpen.set(true);
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  closeToolbarPanels(): void {
    this.profileMenuOpen.set(false);
    this.notificationsOpen.set(false);
    this.messagesOpen.set(false);
    this.appearanceOpen.set(false);
  }

  toggleAppearanceMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (this.appearanceOpen()) {
      this.closeToolbarPanels();
      return;
    }
    this.closeToolbarPanels();
    this.appearancePos.set(this.menuPosFromEvent(event));
    this.appearanceOpen.set(true);
  }

  setAppearance(mode: AppearanceMode): void {
    this.appearance.set(mode);
    this.applyAppearance(mode);
    this.closeToolbarPanels();
  }

  private applyAppearance(mode: AppearanceMode): void {
    const root = document.documentElement;
    const body = document.body;
    root.classList.remove('appearance-split', 'appearance-dark', 'appearance-light', 'dark-mode');
    body.classList.remove('appearance-split', 'appearance-dark', 'appearance-light', 'dark-mode');

    root.classList.add(`appearance-${mode}`);
    body.classList.add(`appearance-${mode}`);

    if (mode === 'dark') {
      root.classList.add('dark-mode');
      body.classList.add('dark-mode');
      root.style.colorScheme = 'dark';
    } else {
      root.style.colorScheme = 'light';
    }

    localStorage.setItem('isp_appearance', mode);
    localStorage.setItem('isp_theme', mode === 'dark' ? 'dark' : 'light');
  }

  markNotificationRead(id: string): void {
    this.notifications.update((list) =>
      list.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  }

  markAllNotificationsRead(): void {
    this.notifications.update((list) => list.map((item) => ({ ...item, read: true })));
  }

  markMessageRead(id: string): void {
    this.messages.update((list) =>
      list.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  }

  private menuPosFromEvent(event: MouseEvent): { top: number; right: number } {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    return {
      top: rect.bottom + 10,
      right: Math.max(12, window.innerWidth - rect.right),
    };
  }

  editNode(node: CourseNode): void {
    if (!this.canEditOutline()) return;
    this.closeNodeMenu();
    this.closeToolbarPanels();
    this.courseModalEditNode.set(node);
    this.courseModalParent.set(null);
    this.courseFormTitle = node.title;
    this.courseFormDescription = node.description || '';
    this.courseFormParentId.set(node.parentId || '');
    this.courseFormError.set('');
    this.savingCourse.set(false);
    this.showCourseModal.set(true);
  }

  addChildNode(node: CourseNode): void {
    this.openCourseModal(node);
  }

  addRootOutlineItem(): void {
    const unit = this.outlineUnitNode();
    if (!unit) return;
    this.openCourseModal(unit);
  }

  openCourseModal(parent: CourseNode | null = null): void {
    if (!this.canEditOutline()) return;
    this.closeNodeMenu();
    this.closeToolbarPanels();
    this.courseModalEditNode.set(null);
    this.courseModalParent.set(parent);
    this.courseFormTitle = '';
    this.courseFormDescription = '';
    this.courseFormParentId.set(parent?.id || '');
    this.courseFormError.set('');
    this.savingCourse.set(false);
    this.showCourseModal.set(true);
  }

  closeCourseModal(): void {
    if (this.savingCourse()) return;
    this.showCourseModal.set(false);
    this.courseModalParent.set(null);
    this.courseModalEditNode.set(null);
    this.courseFormTitle = '';
    this.courseFormDescription = '';
    this.courseFormParentId.set('');
    this.closeParentPicker();
    this.courseFormError.set('');
  }

  toggleParentPicker(event: Event): void {
    event.stopPropagation();
    if (this.parentPickerOpen()) {
      this.closeParentPicker();
      return;
    }
    this.parentPickerQuery.set('');
    this.parentPickerOpen.set(true);
    setTimeout(() => {
      const trigger = document.getElementById('courseSectionParent');
      const search = document.getElementById('courseParentSearch') as HTMLInputElement | null;
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        this.parentPickerDropUp.set(spaceBelow < 240 && rect.top > spaceBelow);
      }
      search?.focus();
    }, 0);
  }

  selectParentOption(id: string): void {
    this.courseFormParentId.set(id);
    this.closeParentPicker();
  }

  closeParentPicker(): void {
    this.parentPickerOpen.set(false);
    this.parentPickerQuery.set('');
    this.parentPickerDropUp.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.parentPickerOpen()) this.closeParentPicker();
    if (!this.hoverOverlayOpen()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.app-sidenav, .toolbar-burger')) return;
    this.collapseHoverSidebar();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.parentPickerOpen()) this.closeParentPicker();
    this.collapseHoverSidebar();
  }

  submitCourseModal(): void {
    const title = this.courseFormTitle.trim();
    if (!title) {
      this.courseFormError.set('Please enter a section title.');
      return;
    }

    this.courseFormError.set('');
    this.savingCourse.set(true);
    const description = this.courseFormDescription.trim();
    const editing = this.courseModalEditNode();
    const parent = this.courseModalParent();
    if (editing && this.outlineParentOptions().length && !this.courseFormParentId()) {
      this.courseFormError.set('Please choose a parent item.');
      this.savingCourse.set(false);
      return;
    }

    const request$ = editing
      ? this.courseService.updateCategory(editing.id, {
          title,
          description,
          parentId: this.courseFormParentId() || editing.parentId || null,
        })
      : parent
        ? this.courseService.createChildCategory(parent.id, title, description, undefined, {
            nodeKind: 'OUTLINE',
            icon: parent.nodeKind === 'UNIT' ? 'description' : parent.icon || 'folder_open',
          })
        : this.courseService.createRootCategory(title, description);

    request$.subscribe({
      next: (created) => {
        const parentId =
          parent?.id || this.courseFormParentId() || editing?.parentId || created?.parentId || null;
        this.expandNodes([parentId, parent?.id, created?.parentId]);
        if (parentId) this.expandAncestorsOf(parentId);
        this.savingCourse.set(false);
        this.showCourseModal.set(false);
        this.courseModalParent.set(null);
        this.courseModalEditNode.set(null);
        this.courseFormParentId.set('');
        this.closeParentPicker();
        this.clearSidebarSearch();
        this.loadCourseTree(parentId);
      },
      error: (err) => {
        console.error('Failed to save course section', err);
        this.savingCourse.set(false);
        this.courseFormError.set(
          err?.error?.message ||
            (editing
              ? 'Could not update the section. Please try again.'
              : 'Could not save the section. Please try again.')
        );
      },
    });
  }

  clearSidebarSearch(): void {
    this.sidebarSearch.set('');
  }

  private filterCourseTree(nodes: CourseNode[], rawQuery: string): CourseNode[] {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return nodes;

    const filterNodes = (list: CourseNode[]): CourseNode[] => {
      const result: CourseNode[] = [];
      for (const node of list) {
        const filteredChildren = filterNodes(node.children || []);
        const selfMatch =
          node.title.toLowerCase().includes(query) ||
          (node.description || '').toLowerCase().includes(query);

        if (selfMatch || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: selfMatch ? node.children : filteredChildren,
            isExpanded: selfMatch || filteredChildren.length > 0 ? true : node.isExpanded,
          });
        }
      }
      return result;
    };

    return filterNodes(nodes);
  }

  deleteNode(node: CourseNode): void {
    if (!this.canEditOutline()) return;
    this.courseService.deleteCategory(node.id).subscribe({
      next: () => {
        this.closeNodeMenu();
        this.loadCourseTree();
      },
      error: (err) => {
        console.error('Failed to delete course section', err);
        this.closeNodeMenu();
      },
    });
  }

  isActive(node: CourseNode): boolean {
    return this.activeContentId() === (node.contentId || node.id);
  }

  isDescendantActive(node: CourseNode): boolean {
    const activeId = this.activeContentId();
    if (!activeId) return false;

    const walk = (n: CourseNode): boolean => {
      if ((n.contentId || n.id) === activeId) return true;
      return (n.children || []).some(walk);
    };
    return walk(node);
  }

  onRailNodeClick(node: CourseNode): void {
    if (this.isLeaf(node)) {
      this.selectLeaf(node);
      return;
    }
    if (!this.hoverSidebar()) {
      this.sidebarCollapsed.set(false);
    } else {
      this.sidebarHovered.set(true);
    }
    this.expandNodes([node.id]);
  }

  railTip(text: string): string {
    return this.hoverSidebar() ? '' : text;
  }

  onSidebarMouseEnter(): void {
    this.clearHoverLeaveTimer();
    if (this.hoverSidebar() && !this.isMobile()) {
      this.sidebarHovered.set(true);
    }
  }

  onSidebarMouseLeave(): void {
    if (!this.hoverSidebar() || this.isMobile()) return;
    if (this.nodeMenuOpen()) return;
    this.clearHoverLeaveTimer();
    this.hoverLeaveTimer = setTimeout(() => this.collapseHoverSidebar(), 120);
  }

  onSidebarProgrammeClick(): void {
    this.rememberOutlineUnit(null);
    this.collapseHoverSidebar();
  }

  collapseHoverSidebar(): void {
    this.clearHoverLeaveTimer();
    if (this.hoverSidebar() && !this.isMobile()) {
      this.sidebarHovered.set(false);
    }
  }

  private clearHoverLeaveTimer(): void {
    if (this.hoverLeaveTimer) {
      clearTimeout(this.hoverLeaveTimer);
      this.hoverLeaveTimer = null;
    }
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileDrawerOpen.update((open) => !open);
    } else if (this.hoverSidebar()) {
      this.sidebarHovered.update((open) => !open);
    } else {
      this.sidebarCollapsed.update((v) => !v);
    }
    this.closeNodeMenu();
    this.closeToolbarPanels();
  }

  closeMobileDrawer(): void {
    if (this.isMobile()) {
      this.mobileDrawerOpen.set(false);
    }
  }

  onSidenavOpenedChange(open: boolean): void {
    if (this.isMobile()) {
      this.mobileDrawerOpen.set(open);
    }
  }

  hasPermission(permission?: string): boolean {
    if (!permission) return true;
    return this.authService.hasPermission(permission);
  }

  canManageCourseContent(): boolean {
    return this.authService.canManageCourseContent();
  }

  canEditOutline(): boolean {
    return this.authService.canManageProgramme(
      this.programmeNode()?.createdBy ?? this.outlineUnitNode()?.createdBy ?? this.activeUnitNode()?.createdBy
    );
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => {
        this.authService.clearSession();
        this.router.navigate(['/login']);
      },
    });
  }

  getInitials(): string {
    const user = this.authService.currentUser;
    if (!user) return '?';
    return user.fullName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
