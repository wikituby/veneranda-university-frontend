import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart } from 'chart.js/auto';
import { CourseService } from '../../core/services/course.service';
import { CreatorDashboard, TimeSeriesPoint } from '../../core/models/course.model';

@Component({
  selector: 'app-creator-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './creator-dashboard.html',
  styleUrl: './creator-dashboard.scss',
})
export class CreatorDashboardPage implements OnInit, AfterViewInit, OnDestroy {
  private courses = inject(CourseService);

  @ViewChild('enrollmentsChart') enrollmentsChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('activeChart') activeChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('subscriptionsChart') subscriptionsChartRef?: ElementRef<HTMLCanvasElement>;

  loading = signal(true);
  refreshing = signal(false);
  error = signal('');
  successMsg = signal('');
  dashboard = signal<CreatorDashboard | null>(null);
  selectedProgrammeId = signal('ALL');
  requestBusy = signal<string | null>(null);
  chartsReady = signal(false);

  private enrollmentsChart?: Chart;
  private activeChart?: Chart;
  private subscriptionsChart?: Chart;

  ngOnInit(): void {
    this.load(false);
  }

  ngAfterViewInit(): void {
    this.chartsReady.set(true);
    this.scheduleChartRender();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  load(showFullLoading = true): void {
    if (showFullLoading) {
      this.loading.set(true);
    } else {
      this.refreshing.set(true);
    }
    this.error.set('');
    const programmeId = this.selectedProgrammeId() === 'ALL' ? undefined : this.selectedProgrammeId();
    this.courses.getCreatorDashboard(programmeId).subscribe({
      next: (data) => {
        this.dashboard.set(data);
        this.loading.set(false);
        this.refreshing.set(false);
        this.scheduleChartRender();
      },
      error: (err) => {
        const msg = err?.error?.message;
        this.error.set(msg || 'Could not load creator dashboard. Make sure the backend is running with the latest API.');
        this.loading.set(false);
        this.refreshing.set(false);
      },
    });
  }

  onProgrammeChange(event: Event): void {
    this.selectedProgrammeId.set((event.target as HTMLSelectElement).value);
    this.load(true);
  }

  filterProgramme(programmeId: string): void {
    this.selectedProgrammeId.set(programmeId);
    this.load(true);
  }

  formatRevenue(amount?: number | null, currency = 'UGX'): string {
    const value = Number(amount ?? 0);
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
    } catch {
      return `${currency} ${value.toLocaleString()}`;
    }
  }

  formatEnrolledDate(raw?: string | null): string {
    if (!raw) return 'Recently';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  joinModeLabel(mode?: string): string {
    return (mode || 'OPEN').toUpperCase() === 'REQUEST' ? 'Request to join' : 'Open join';
  }

  acceptJoin(programmeId: string, enrollmentId?: string): void {
    if (!enrollmentId) return;
    this.requestBusy.set(enrollmentId);
    this.successMsg.set('');
    this.courses.acceptJoinRequest(programmeId, enrollmentId).subscribe({
      next: () => {
        this.requestBusy.set(null);
        this.successMsg.set('Join request accepted. The learner can now access the programme.');
        this.load(false);
      },
      error: () => {
        this.requestBusy.set(null);
        this.error.set('Could not accept the join request.');
      },
    });
  }

  rejectJoin(programmeId: string, enrollmentId?: string): void {
    if (!enrollmentId) return;
    this.requestBusy.set(enrollmentId);
    this.successMsg.set('');
    this.courses.rejectJoinRequest(programmeId, enrollmentId).subscribe({
      next: () => {
        this.requestBusy.set(null);
        this.successMsg.set('Join request rejected.');
        this.load(false);
      },
      error: () => {
        this.requestBusy.set(null);
        this.error.set('Could not reject the join request.');
      },
    });
  }

  private scheduleChartRender(): void {
    if (!this.chartsReady()) return;
    setTimeout(() => this.renderCharts(), 0);
  }

  private renderCharts(): void {
    if (!this.chartsReady() || !this.dashboard()) return;
    const data = this.dashboard()!;
    this.renderBarChart(
      this.enrollmentsChartRef,
      data.enrollmentsOverTime,
      'New joins',
      this.enrollmentsChart,
      (c) => {
        this.enrollmentsChart = c;
      },
    );
    this.renderLineChart(
      this.activeChartRef,
      data.activeStudentsOverTime,
      'Active students',
      this.activeChart,
      (c) => {
        this.activeChart = c;
      },
    );
    this.renderBarChart(
      this.subscriptionsChartRef,
      data.subscriptionsOverTime,
      'New subscriptions',
      this.subscriptionsChart,
      (c) => {
        this.subscriptionsChart = c;
      },
    );
  }

  private renderBarChart(
    ref: ElementRef<HTMLCanvasElement> | undefined,
    points: TimeSeriesPoint[],
    label: string,
    existing?: Chart,
    store?: (chart: Chart) => void,
  ): void {
    if (!ref?.nativeElement) return;
    existing?.destroy();
    const labels = points.length ? points.map((p) => p.label) : ['No data'];
    const values = points.length ? points.map((p) => p.value) : [0];
    const chart = new Chart(ref.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            backgroundColor: 'rgba(37, 99, 235, 0.55)',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
    if (store) store(chart);
  }

  private renderLineChart(
    ref: ElementRef<HTMLCanvasElement> | undefined,
    points: TimeSeriesPoint[],
    label: string,
    existing?: Chart,
    store?: (chart: Chart) => void,
  ): void {
    if (!ref?.nativeElement) return;
    existing?.destroy();
    const labels = points.length ? points.map((p) => p.label) : ['No data'];
    const values = points.length ? points.map((p) => p.value) : [0];
    const chart = new Chart(ref.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label,
            data: values,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
    if (store) store(chart);
  }

  private destroyCharts(): void {
    this.enrollmentsChart?.destroy();
    this.activeChart?.destroy();
    this.subscriptionsChart?.destroy();
  }
}