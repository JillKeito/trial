import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Voter } from '../../../../services/election';
import { AuthService } from '../../../../services/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-voters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voters.html',
  styleUrl: './voters.scss',
})
export class Voters implements OnInit {

  voters: Voter[] = [];
  showVoterModal = false;
  voterSearch = '';
  loading = false;
  saving = false;

  newVoter = {
    studentId: '',
    name: '',
    course: '',
    year: '1st',
    password: '',
    confirmPassword: '',
  };

  voterYears = ['1st', '2nd', '3rd', '4th'];

  // Exposed for the template
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private svc: ElectionService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void { this.loadVoters(); }

  loadVoters(): void {
    this.loading = true;
    this.svc.getVoters().subscribe(v => {
      this.voters = v;
      this.loading = false;
    });
  }

  get filteredVoters(): Voter[] {
    const q = this.voterSearch.toLowerCase();
    if (!q) return this.voters;
    return this.voters.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.studentId.toLowerCase().includes(q) ||
      v.course.toLowerCase().includes(q)
    );
  }

  get totalVoters(): number   { return this.voters.length; }
  get votedCount(): number    { return this.voters.filter(v => v.hasVoted).length; }
  get notVotedCount(): number { return this.totalVoters - this.votedCount; }
  get participationRate(): number {
    return this.totalVoters > 0
      ? Math.round((this.votedCount / this.totalVoters) * 100) : 0;
  }

  openModal(): void {
    this.newVoter = { studentId: '', name: '', course: '', year: '1st', password: '', confirmPassword: '' };
    this.showPassword = false;
    this.showConfirmPassword = false;
    this.showVoterModal = true;
  }

  closeModal(): void {
    this.showVoterModal = false;
  }

  markVoted(voter: Voter): void {
    const updated: Voter = {
      ...voter,
      hasVoted: true,
      verifiedAt: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
    };
    this.svc.updateVoter(updated).subscribe(() => this.loadVoters());
  }

  deleteVoter(voter: Voter): void {
    Swal.fire({
      title: 'Delete voter?',
      text: `Remove ${voter.name} from the list?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete'
    }).then(r => {
      if (r.isConfirmed) {
        this.svc.deleteVoter(voter.id).subscribe(() => this.loadVoters());
      }
    });
  }

  // ── Add Voter (with Firebase Auth registration) ──────────────
  async addVoterSubmit(): Promise<void> {
    const { studentId, name, course, year, password, confirmPassword } = this.newVoter;

    // Basic validation
    if (!studentId.trim() || !name.trim() || !course.trim()) {
      Swal.fire('Missing fields', 'Student ID, Name, and Course are required.', 'warning');
      return;
    }

    if (!password) {
      Swal.fire('No password', 'Please set a login password for this voter.', 'warning');
      return;
    }

    if (password.length < 6) {
      Swal.fire('Weak password', 'Password must be at least 6 characters.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      Swal.fire('Password mismatch', 'Passwords do not match.', 'warning');
      return;
    }

    this.saving = true;

    try {
      // This creates Firebase Auth account + users/ doc + voters/ doc
      await this.authService.registerVoter({ studentId, name, course, year, password });

      await Swal.fire({
        icon: 'success',
        title: 'Voter Added!',
        html: `
          <p><strong>${name}</strong> has been registered.</p>
          <p style="margin-top:8px; font-size:13px; color:#555;">
            They can now log in using:<br/>
            <strong>Student ID:</strong> ${studentId}
          </p>
        `,
        confirmButtonColor: '#4f46e5',
      });

      this.closeModal();
      this.loadVoters();

    } catch (err: any) {
      // Firebase Auth error codes
      const msg =
        err?.code === 'auth/email-already-in-use'
          ? `Student ID <strong>${studentId}</strong> is already registered.`
          : err?.code === 'auth/invalid-email'
          ? 'The Student ID contains invalid characters.'
          : err?.message || 'Something went wrong. Please try again.';

      Swal.fire({ icon: 'error', title: 'Registration Failed', html: msg });

    } finally {
      this.saving = false;
    }
  }
}