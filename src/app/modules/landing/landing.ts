import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  private auth = inject(AuthService);

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn;
  }

  readonly slides = [
    {
      url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1920&q=80',
      kicker: 'Learn without limits',
      title: 'Study medicine and community health from anywhere.',
    },
    {
      url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1920&q=80',
      kicker: 'Clinical programmes',
      title: 'Diploma in Clinical Medicine. MBChB. Taught by practising lecturers.',
    },
    {
      url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1920&q=80',
      kicker: 'Pay as you learn',
      title: 'Subscribe to a full semester, or unlock a single course unit.',
    },
    {
      url: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=1920&q=80',
      kicker: 'Build the next cohort',
      title: 'Coordinators can register a new programme and cascade years, semesters, and units.',
    },
  ];
}
