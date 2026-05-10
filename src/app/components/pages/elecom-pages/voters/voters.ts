import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Voter } from '../../../../services/election';
import { AuthService } from '../../../../services/auth';
import Swal from 'sweetalert2';

// Key used to persist the draft in sessionStorage
const DRAFT_KEY = 'voters_form_draft';

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
  voterSearch    = '';
  loading        = false;
  saving         = false;

  // ── Form model ────────────────────────────────────────────────
  newVoter = this.emptyForm();

  voterYears          = ['1st', '2nd', '3rd', '4th'];
  showPassword        = false;
  showConfirmPassword = false;
  photoPreview: string | null = null;

  // Whether there is a saved draft waiting to be restored
  hasDraft = false;

  constructor(
    private svc:         ElectionService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadVoters();
    // Check on load if there's an unfinished draft from a previous session
    this.hasDraft = !!sessionStorage.getItem(DRAFT_KEY);
  }

  // ── Empty form factory ────────────────────────────────────────
  private emptyForm() {
    return {
      studentId:       '',
      name:            '',
      course:          '',
      year:            '1st',
      password:        '',
      confirmPassword: '',
      photo:           '',
    };
  }

  // ── Draft: save on every keystroke ───────────────────────────
  // Called via (ngModelChange) on every input in the HTML
  saveDraft(): void {
    // Never persist passwords for security — only the other fields
    const { password, confirmPassword, ...safe } = this.newVoter;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...safe,
      photoPreview: this.photoPreview,
    }));
    this.hasDraft = true;
  }

  // ── Draft: restore ────────────────────────────────────────────
  private restoreDraft(): void {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      this.newVoter = {
        ...this.emptyForm(),
        studentId: draft.studentId ?? '',
        name:      draft.name      ?? '',
        course:    draft.course    ?? '',
        year:      draft.year      ?? '1st',
        photo:     draft.photo     ?? '',
      };
      this.photoPreview = draft.photoPreview ?? null;
      // Passwords are NOT restored — user must re-enter them
    } catch { /* malformed draft — ignore */ }
  }

  // ── Draft: clear ──────────────────────────────────────────────
  private clearDraft(): void {
    sessionStorage.removeItem(DRAFT_KEY);
    this.hasDraft = false;
  }

  // ── Open modal ────────────────────────────────────────────────
  openModal(): void {
    // If a draft exists, restore it so user can continue where they left off
    if (sessionStorage.getItem(DRAFT_KEY)) {
      this.restoreDraft();
    } else {
      this.newVoter     = this.emptyForm();
      this.photoPreview = null;
    }
    this.showPassword        = false;
    this.showConfirmPassword = false;
    this.showVoterModal      = true;
  }

  // ── Close modal (clicking outside or Cancel) ──────────────────
  // Saves progress automatically — user does NOT lose their input
  closeModal(): void {
    if (this.saving) return; // block close while a save is in flight

    const hasInput =
      this.newVoter.studentId ||
      this.newVoter.name      ||
      this.newVoter.course    ||
      this.newVoter.photo;

    if (hasInput) {
      // Auto-save draft silently — no popup needed
      this.saveDraft();
    }

    this.showVoterModal = false;
  }

  // ── Discard draft explicitly (Cancel button in modal) ─────────
  async discardAndClose(): Promise<void> {
    if (this.saving) return;

    const hasInput =
      this.newVoter.studentId ||
      this.newVoter.name      ||
      this.newVoter.course    ||
      this.newVoter.photo;

    if (hasInput) {
      const result = await Swal.fire({
        title: 'Discard changes?',
        text:  'Your progress will be lost.',
        icon:  'warning',
        showCancelButton:    true,
        confirmButtonColor:  '#ef4444',
        cancelButtonColor:   '#6b7280',
        confirmButtonText:   'Discard',
        cancelButtonText:    'Keep editing',
      });
      if (!result.isConfirmed) return; // user chose to keep editing
    }

    this.clearDraft();
    this.newVoter     = this.emptyForm();
    this.photoPreview = null;
    this.showVoterModal = false;
  }

  // ── Load voters ───────────────────────────────────────────────
  loadVoters(): void {
    this.loading = true;
    this.svc.getVoters().subscribe(v => {
      this.voters  = v;
      this.loading = false;
    });
  }

  // ── Filtering ─────────────────────────────────────────────────
  get filteredVoters(): Voter[] {
    const q = this.voterSearch.toLowerCase();
    if (!q) return this.voters;
    return this.voters.filter(v =>
      v.name.toLowerCase().includes(q)      ||
      v.studentId.toLowerCase().includes(q) ||
      v.course.toLowerCase().includes(q)
    );
  }

  // ── Stats ─────────────────────────────────────────────────────
  get totalVoters():       number { return this.voters.length; }
  get votedCount():        number { return this.voters.filter(v => v.hasVoted).length; }
  get notVotedCount():     number { return this.totalVoters - this.votedCount; }
  get participationRate(): number {
    return this.totalVoters > 0
      ? Math.round((this.votedCount / this.totalVoters) * 100) : 0;
  }

  // ── Photo ─────────────────────────────────────────────────────
  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Swal.fire('Invalid file', 'Please select an image file.', 'warning'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      Swal.fire('File too large', 'Photo must be under 2MB.', 'warning'); return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target?.result as string;
      this.photoPreview  = b64;
      this.newVoter.photo = b64;
      this.saveDraft();   // auto-save after photo is loaded
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.photoPreview   = null;
    this.newVoter.photo = '';
    this.saveDraft();
  }

  // ── Helpers ───────────────────────────────────────────────────
  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';
  }

  markVoted(voter: Voter): void {
    const updated: Voter = {
      ...voter,
      hasVoted:   true,
      verifiedAt: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
    };
    this.svc.updateVoter(updated).subscribe(() => this.loadVoters());
  }

  deleteVoter(voter: Voter): void {
    Swal.fire({
      title: 'Delete voter?',
      text:  `Remove ${voter.name} from the list?`,
      icon:  'warning',
      showCancelButton:   true,
      confirmButtonColor: '#ef4444',
      confirmButtonText:  'Delete',
    }).then(r => {
      if (r.isConfirmed)
        this.svc.deleteVoter(voter.id).subscribe(() => this.loadVoters());
    });
  }

  // ── Submit ────────────────────────────────────────────────────
  async addVoterSubmit(): Promise<void> {
    const { studentId, name, course, year, password, confirmPassword, photo } = this.newVoter;

    if (!studentId.trim() || !name.trim() || !course.trim()) {
      Swal.fire('Missing fields', 'Student ID, Name, and Course are required.', 'warning'); return;
    }
    if (!password) {
      Swal.fire('No password', 'Please set a login password.', 'warning'); return;
    }
    if (password.length < 6) {
      Swal.fire('Weak password', 'Password must be at least 6 characters.', 'warning'); return;
    }
    if (password !== confirmPassword) {
      Swal.fire('Password mismatch', 'Passwords do not match.', 'warning'); return;
    }

    this.saving = true;

    try {
      await this.authService.registerVoter({ studentId, name, course, year, password });

      // Success — clear draft since registration is complete
      this.clearDraft();

      await Swal.fire({
        icon:  'success',
        title: 'Voter Added!',
        html:  `
          <p><strong>${name}</strong> has been registered.</p>
          <p style="margin-top:8px; font-size:13px; color:#555;">
            They can now log in using:<br/>
            <strong>Student ID:</strong> ${studentId}
          </p>
        `,
        confirmButtonColor: '#1e3a5f',
      });

      this.showVoterModal = false;
      this.newVoter       = this.emptyForm();
      this.photoPreview   = null;
      this.loadVoters();

    } catch (err: any) {
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