import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ElectionService } from '../../../services/election';
import { AuthService } from '../../../services/auth';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import Swal from 'sweetalert2';

export interface Activity {
  type: 'user' | 'vote' | 'warning';
  title: string;
  subtitle: string;
  time: string;
}

@Component({
  selector: 'app-elecom-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './elecom-dashboard.html',
  styleUrl: './elecom-dashboard.scss',
})
export class ElecomDashboard implements OnInit, OnDestroy {
  // ── Firebase ──────────────────────────────────────────────────
  private firebaseAuth = inject(Auth);
  private firestore = inject(Firestore);
  private authSvc = inject(AuthService);

  stats = {
    totalVoters: 0,
    voted: 0,
    notVoted: 0,
  };

  // ── Create student voter account modal ────────────────────────
  showAccountModal = false;
  accountForm = { name: '', email: '', password: '', course: '', year: '' };
  creatingAccount = false;

  recentActivities: Activity[] = [];

  constructor(
    private svc: ElectionService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  ngOnDestroy(): void {}

  loadStats(): void {
    this.svc.getVoters().subscribe((voters) => {
      this.stats.totalVoters = voters.length;
      this.stats.voted = voters.filter((v) => v.hasVoted).length;
      this.stats.notVoted = this.stats.totalVoters - this.stats.voted;
    });
  }

  // ── Create student voter account ──────────────────────────────
  // ELECOM creates student voter accounts (per spec).
  openAccountModal() {
    this.showAccountModal = true;
    this.accountForm = { name: '', email: '', password: '', course: '', year: '' };
  }

  closeAccountModal() {
    this.showAccountModal = false;
  }

  async createStudentAccount() {
    const { name, email, password, course, year } = this.accountForm;
    if (!name || !email || !password) {
      Swal.fire({ icon: 'warning', title: 'Please fill in all required fields.' });
      return;
    }

    this.creatingAccount = true;

    try {
      const credential = await createUserWithEmailAndPassword(this.firebaseAuth, email, password);

      await setDoc(doc(this.firestore, 'users', credential.user.uid), {
        name,
        email,
        role: 'student',        // ← ELECOM creates student accounts
        course,
        year,
        createdAt: new Date().toISOString(),
      });

      this.creatingAccount = false;
      this.closeAccountModal();

      this.addActivity('user', 'Student account created', name, this.nowStr());

      Swal.fire({
        icon: 'success',
        title: 'Student Account Created!',
        text: `${name} can now log in to the student portal.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      this.creatingAccount = false;
      if (err.code === 'auth/email-already-in-use') {
        Swal.fire({ icon: 'error', title: 'Email already in use.' });
      } else if (err.code === 'auth/weak-password') {
        Swal.fire({ icon: 'error', title: 'Password must be at least 6 characters.' });
      } else {
        Swal.fire({ icon: 'error', title: 'Failed to create account. Try again.' });
      }
    }
  }

  // ── Computed getters ──────────────────────────────────────────
  get participationRate(): number {
    return this.stats.totalVoters > 0
      ? Math.round((this.stats.voted / this.stats.totalVoters) * 100)
      : 0;
  }

  // ── Helpers ───────────────────────────────────────────────────
  addActivity(type: Activity['type'], title: string, subtitle: string, time: string): void {
    this.recentActivities.unshift({ type, title, subtitle, time });
    if (this.recentActivities.length > 10) this.recentActivities.pop();
  }

  nowStr(): string {
    return new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }

  goTo(path: string): void {
    this.router.navigate(['/app/' + path.replace('/', '')]);
  }
}