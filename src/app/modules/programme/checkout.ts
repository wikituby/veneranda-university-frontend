import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CourseService } from '../../core/services/course.service';
import { CourseCategory } from '../../core/models/course.model';
import { environment } from '../../../environments/environment';
import { coordinatorShare, formatKes, formatMoney, kindLabel, priceFor, programmeHeading } from '../../core/utils/programme.util';

export interface PayOption {
  id: string;
  categoryId: string;
  kind: string;
  title: string;
  blurb: string;
  amount: number;
  coordinatorAmount?: number;
  serverFeeAmount?: number;
  currency: string;
  paid: boolean;
  trial?: boolean;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private courses = inject(CourseService);

  readonly formatKes = formatKes;
  readonly formatMoney = formatMoney;
  readonly kindLabel = kindLabel;

  loading = signal(true);
  paying = signal(false);
  verifying = signal(false);
  error = signal('');
  enrolled = signal(false);
  item = signal<CourseCategory | null>(null);
  options = signal<PayOption[]>([]);
  selectedId = signal<string | null>(null);
  method = signal<'visa' | 'mtn' | 'airtel'>('visa');
  phone = signal('');
  private all = signal<CourseCategory[]>([]);
  private paidIds = signal(new Set<string>());

  readonly selected = computed(() => this.options().find((o) => o.id === this.selectedId()) || null);
  readonly isTrial = computed(() => !!this.selected()?.trial);
  readonly needsPhone = computed(() => this.method() === 'mtn' || this.method() === 'airtel');

  readonly methods = [
    { id: 'visa' as const, label: 'Visa card', hint: 'Continue to Flutterwave to enter your card securely' },
    { id: 'mtn' as const, label: 'MTN Mobile Money', hint: 'Pay with MTN via Flutterwave' },
    { id: 'airtel' as const, label: 'Airtel Money', hint: 'Pay with Airtel via Flutterwave' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('categoryId');
    if (!id) {
      this.router.navigateByUrl('/explore');
      return;
    }

    const txRef = this.route.snapshot.queryParamMap.get('tx_ref');
    if (txRef) {
      this.verifying.set(true);
      this.loading.set(false);
      this.courses.verifyFlutterwavePayment(txRef).subscribe({
        next: () => {
          this.verifying.set(false);
          this.courses.getCategories(true).subscribe({
            next: (cats) => {
              this.all.set(cats || []);
              const item = (cats || []).find((c) => c.id === id) || null;
              this.item.set(item);
              this.goHomeAfterPay();
            },
            error: () => this.router.navigate(['/programmes', id], { replaceUrl: true }),
          });
        },
        error: (err) => {
          this.verifying.set(false);
          this.error.set(err.error?.message || 'Could not confirm payment. If you paid, contact support with your reference.');
          this.loadCheckout(id);
        },
      });
      return;
    }

    this.loadCheckout(id);
  }

  private loadCheckout(id: string): void {
    this.loading.set(true);
    forkJoin({
      cats: this.courses.getCategories(true),
      subs: this.courses.listMySubscriptions(),
      access: this.courses.getAccess(id),
    }).subscribe({
      next: ({ cats, subs, access }) => {
        const list = cats || [];
        this.all.set(list);
        const item = list.find((c) => c.id === id) || null;
        this.item.set(item);
        this.enrolled.set(!!access.enrolled);
        this.paidIds.set(new Set((subs || []).filter((s) => s.paid).map((s) => s.categoryId)));
        const options = this.buildOptions(item, list);
        this.options.set(options);
        const current = options.find((o) => o.categoryId === id && !o.trial && !o.paid);
        const firstUnpaid = options.find((o) => !o.paid);
        this.selectedId.set(current?.id ?? firstUnpaid?.id ?? options[0]?.id ?? id);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load checkout.');
        this.loading.set(false);
      },
    });
  }

  programmeHref(): string {
    const item = this.item();
    if (!item) return '/explore';
    return `/programmes/${this.programmeId(item)}`;
  }

  choose(option: PayOption): void {
    if (option.paid) return;
    this.selectedId.set(option.id);
  }

  chooseMethod(id: 'visa' | 'mtn' | 'airtel'): void {
    this.method.set(id);
    this.error.set('');
  }

  onPhone(event: Event): void {
    this.phone.set((event.target as HTMLInputElement).value);
  }

  private paymentReady(): boolean {
    if (!this.needsPhone()) return true;
    return /^\+?\d{9,15}$/.test(this.phone().replace(/\s/g, ''));
  }

  pay(): void {
    const option = this.selected();
    const item = this.item();
    if (!option || option.paid || !item) return;
    this.paying.set(true);
    this.error.set('');
    if (!this.enrolled()) {
      this.paying.set(false);
      this.error.set('Join this programme from Home before you pay.');
      return;
    }
    if (!this.isTrial() && !this.paymentReady()) {
      this.paying.set(false);
      this.error.set('Enter a valid mobile money number to continue.');
      return;
    }
    this.courses.checkout(option.categoryId, !!option.trial, {
      paymentMethod: this.isTrial() ? undefined : this.method(),
      phone: this.needsPhone() ? this.phone().replace(/\s/g, '') : undefined,
    }).subscribe({
      next: (result) => {
        if (result.requiresRedirect && result.paymentLink) {
          window.location.href = result.paymentLink;
          return;
        }
        this.paying.set(false);
        this.paidIds.update((ids) => new Set(ids).add(option.categoryId));
        this.options.update((list) =>
          list.map((row) => row.categoryId === option.categoryId ? { ...row, paid: true } : row)
        );
        this.goHomeAfterPay();
      },
      error: (err) => {
        this.paying.set(false);
        this.error.set(err.error?.message || 'Payment could not be started. Join the programme first.');
      },
    });
  }

  private goHomeAfterPay(): void {
    const item = this.item();
    if (!item) {
      this.router.navigateByUrl('/explore');
      return;
    }
    this.router.navigate(['/programmes', this.programmeId(item)]);
  }

  private buildOptions(item: CourseCategory | null, all: CourseCategory[]): PayOption[] {
    if (!item) return [];
    const chain = this.ancestorsAndSelf(item, all).filter((c) =>
      ['UNIT', 'SEMESTER', 'YEAR', 'PROGRAMME'].includes(c.nodeKind || ''),
    );
    const blurbs: Record<string, string> = {
      UNIT: 'Unlock only this course unit. Other units, semesters, years, and the programme stay locked.',
      SEMESTER: 'Unlock every course unit in this semester. Other semesters stay locked.',
      YEAR: 'Unlock every semester and course unit in this year. Other years stay locked.',
      PROGRAMME: 'Unlock the whole programme: every year, semester, and course unit.',
    };
    const fee = environment.serverFeeAmount ?? 5000;
    const currency = environment.defaultCurrency || 'UGX';
    const options: PayOption[] = chain.map((c) => {
      const share = coordinatorShare(c.priceAmount, c.nodeKind);
      const serverFee = c.serverFeeAmount ?? fee;
      return {
        id: c.id,
        categoryId: c.id,
        kind: c.nodeKind || '',
        title: programmeHeading(c),
        blurb: blurbs[c.nodeKind || ''] || 'Unlock this item.',
        amount: priceFor(c),
        coordinatorAmount: share,
        serverFeeAmount: serverFee,
        currency: c.currency || currency,
        paid: this.paidIds().has(c.id) || this.coveredByAncestor(c.id, chain),
      };
    });
    options.push({
      id: `free:${item.id}`,
      categoryId: item.id,
      kind: 'FREE',
      title: 'Free trial',
      blurb: `Unlock only “${programmeHeading(item)}” for 48 hours. Nothing above it is included.`,
      amount: 0,
      coordinatorAmount: 0,
      serverFeeAmount: 0,
      currency: item.currency || currency,
      paid: this.paidIds().has(item.id) || this.coveredByAncestor(item.id, chain),
      trial: true,
    });
    return options;
  }

  private coveredByAncestor(categoryId: string, chain: CourseCategory[]): boolean {
    const index = chain.findIndex((c) => c.id === categoryId);
    if (index < 0) return false;
    return chain.slice(index + 1).some((ancestor) => this.paidIds().has(ancestor.id));
  }

  private ancestorsAndSelf(item: CourseCategory, all: CourseCategory[]): CourseCategory[] {
    const byId = new Map(all.map((c) => [c.id, c]));
    const chain: CourseCategory[] = [];
    let current: CourseCategory | undefined = item;
    let guard = 0;
    while (current && guard++ < 50) {
      chain.push(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
  }

  private programmeId(item: CourseCategory): string {
    const chain = this.ancestorsAndSelf(item, this.all());
    return chain[chain.length - 1]?.id || item.id;
  }
}
