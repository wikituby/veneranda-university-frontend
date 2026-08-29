import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CourseService } from '../../core/services/course.service';
import { CourseCategory } from '../../core/models/course.model';
import { environment } from '../../../environments/environment';
import { coordinatorShare, formatKes, formatMoney, kindLabel, priceFor, programmeHeading } from '../../core/utils/programme.util';
import { CatalogueTopbar } from '../../layout/catalogue-topbar/catalogue-topbar';

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
  imports: [CommonModule, RouterLink, CatalogueTopbar],
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
  error = signal('');
  enrolled = signal(false);
  item = signal<CourseCategory | null>(null);
  options = signal<PayOption[]>([]);
  selectedId = signal<string | null>(null);
  method = signal<'visa' | 'mtn' | 'airtel'>('visa');
  cardName = signal('');
  cardNumber = signal('');
  expiry = signal('');
  cvc = signal('');
  phone = signal('');
  private all = signal<CourseCategory[]>([]);
  private paidIds = signal(new Set<string>());

  readonly selected = computed(() => this.options().find((o) => o.id === this.selectedId()) || null);
  readonly isTrial = computed(() => !!this.selected()?.trial);

  readonly methods = [
    { id: 'visa' as const, label: 'Visa card', hint: 'Pay with Visa debit or credit' },
    { id: 'mtn' as const, label: 'MTN Mobile Money', hint: 'Pay with your MTN number' },
    { id: 'airtel' as const, label: 'Airtel Money', hint: 'Pay with your Airtel number' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('categoryId');
    if (!id) {
      this.router.navigateByUrl('/home');
      return;
    }
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
    if (!item) return '/home';
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

  onCardName(event: Event): void {
    this.cardName.set((event.target as HTMLInputElement).value);
  }

  onCardNumber(event: Event): void {
    const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 16);
    this.cardNumber.set(digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim());
  }

  onExpiry(event: Event): void {
    const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
    this.expiry.set(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  }

  onCvc(event: Event): void {
    this.cvc.set((event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4));
  }

  onPhone(event: Event): void {
    this.phone.set((event.target as HTMLInputElement).value);
  }

  private paymentReady(): boolean {
    if (this.method() === 'visa') {
      const number = this.cardNumber().replace(/\s/g, '');
      return this.cardName().trim().length > 2
        && /^\d{13,16}$/.test(number)
        && /^\d{2}\/\d{2}$/.test(this.expiry())
        && /^\d{3,4}$/.test(this.cvc());
    }
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
      this.error.set(this.method() === 'visa'
        ? 'Enter your Visa card details to continue.'
        : 'Enter a valid mobile money number to continue.');
      return;
    }
    this.courses.checkout(option.categoryId, !!option.trial).subscribe({
      next: () => {
        this.paying.set(false);
        this.paidIds.update((ids) => new Set(ids).add(option.categoryId));
        this.options.update((list) =>
          list.map((item) => item.categoryId === option.categoryId ? { ...item, paid: true } : item)
        );
        this.goHomeAfterPay();
      },
      error: (err) => {
        this.paying.set(false);
        this.error.set(err.error?.message || 'Payment could not be completed. Join the programme first.');
      },
    });
  }

  private goHomeAfterPay(): void {
    const item = this.item();
    if (!item) {
      this.router.navigateByUrl('/home');
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
        currency: c.currency || environment.defaultCurrency || 'UGX',
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
      currency: item.currency || environment.defaultCurrency || 'UGX',
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
