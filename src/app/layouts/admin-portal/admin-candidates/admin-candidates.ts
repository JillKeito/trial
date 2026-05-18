import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Candidate, Election, Application } from '../../../services/election';
import { AuthService } from '../../../services/auth';
import Swal from 'sweetalert2';

const POSITIONS: Record<string, string[]> = {
  ATLAS: [
    'President',
    'Vice President',
    'Secretary',
    'Treasurer',
    'Auditor',
    'PRO',
    'Business Manager',
    '1st Year Rep',
    '2nd Year Rep',
    '3rd Year Rep',
    '4th Year Rep',
    'Sergeant-at-Arms',
  ],
  USG: ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PRO'],
  STCM: ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PRO'],
  AEMT: ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PRO'],
};

const ORGANIZATIONS = Object.keys(POSITIONS);
const COURSES = ['BSIT', 'BSTCM', 'BSEMT', 'BSCS', 'BSEd', 'BSED', 'BSN', 'Other'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

@Component({
  selector: 'app-admin-candidates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-candidates.html',
  styleUrls: ['./admin-candidates.scss'],
})
export class AdminCandidates implements OnInit {
  // ── Tab & list state ─────────────────────────────────────────
  activeTab: 'candidates' | 'applications' = 'candidates';
  candidates: (Candidate & { electionId?: string; organization?: string })[] = [];
  elections: Election[] = [];
  loading = false;
  applications: Application[] = [];
  loadingApps = false;

  // ── Filters ──────────────────────────────────────────────────
  appFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'pending';
  filterStatus: 'all' | 'pending' | 'approved' | 'disqualified' = 'all';
  filterOrg = '';
  filterElection = '';
  searchText = '';

  // ── Register modal ───────────────────────────────────────────
  showModal = false;
  saving = false;

  form: {
    name: string;
    organization: string;
    position: string;
    electionId: string;
    party: string;
    bio: string;
    course: string;
    year: string;
    status: 'pending' | 'approved' | 'disqualified';
    votes: number;
  } = this.emptyForm();

  // ── Tracks the application record tied to the selected candidate ──
  selectedApplication: Application | null = null;

  // ── Detail modal ─────────────────────────────────────────────
  showDetailModal = false;
  detailCandidate: (Candidate & { electionId?: string; organization?: string }) | null = null;

  // ── Constants ────────────────────────────────────────────────
  readonly orgs = ORGANIZATIONS;
  readonly courses = COURSES;
  readonly years = YEARS;

  constructor(
    private svc: ElectionService,
    private auth: AuthService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
    this.loadApplications();
  }

  load(): void {
    this.loading = true;
    this.svc.getElections().subscribe((e) => {
      this.elections = e;
    });
    this.svc.getCandidates().subscribe((c) => {
      this.candidates = c as any[];
      this.loading = false;
    });
  }

  loadApplications(): void {
    this.loadingApps = true;
    this.svc.getApplications().subscribe((apps) => {
      this.applications = apps;
      this.loadingApps = false;
    });
  }

  // ── Computed lists ───────────────────────────────────────────
  get filteredCandidates() {
    return this.candidates.filter((c) => {
      const matchStatus = this.filterStatus === 'all' || c.status === this.filterStatus;
      const matchOrg = !this.filterOrg || (c as any).organization === this.filterOrg;
      const matchElection = !this.filterElection || (c as any).electionId === this.filterElection;
      const q = this.searchText.toLowerCase();
      const matchSearch =
        !q || c.name.toLowerCase().includes(q) || c.position.toLowerCase().includes(q);
      return matchStatus && matchOrg && matchElection && matchSearch;
    });
  }

  get filteredApplications(): Application[] {
    if (this.appFilter === 'all') return this.applications;
    return this.applications.filter((a) => a.status === this.appFilter);
  }

  // ── Counts ───────────────────────────────────────────────────
  get totalCount() {
    return this.candidates.length;
  }
  get approvedCount() {
    return this.candidates.filter((c) => c.status === 'approved').length;
  }
  get pendingCount() {
    return this.candidates.filter((c) => c.status === 'pending').length;
  }
  get disqualifiedCount() {
    return this.candidates.filter((c) => c.status === 'disqualified').length;
  }
  get pendingAppCount() {
    return this.applications.filter((a) => a.status === 'pending').length;
  }

  // ── Helpers ──────────────────────────────────────────────────
  electionName(id: string): string {
    return this.elections.find((e) => e.id === id)?.name ?? '—';
  }
  electionNameById(id: string): string {
    return this.elections.find((e) => e.id === id)?.name ?? '—';
  }
  reqCount(reqs: any): number {
    if (!reqs) return 0;
    return Object.values(reqs).filter(Boolean).length;
  }
  initial(name: string): string {
    return name?.charAt(0)?.toUpperCase() ?? '?';
  }
  avatarBg(i: number): string {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981'];
    return colors[i % colors.length];
  }
  statusClass(s?: string) {
    return s === 'approved'
      ? 'badge-approved'
      : s === 'pending'
        ? 'badge-pending'
        : 'badge-disqualified';
  }
  appStatusClass(s?: string) {
    return s === 'approved'
      ? 'badge-approved'
      : s === 'rejected'
        ? 'badge-disqualified'
        : 'badge-pending';
  }
  isPositionTaken(pos: string): boolean {
    return this.takenPositions.includes(pos);
  }

  // ── Slot / position helpers ───────────────────────────────────
  get positionsForOrg(): string[] {
    return POSITIONS[this.form.organization] ?? [];
  }
  get availableElections(): Election[] {
    return this.elections.filter((e) => e.status === 'upcoming' || e.status === 'active');
  }
  get selectedElection(): Election | null {
    return this.elections.find((e) => e.id === this.form.electionId) ?? null;
  }
  get candidatesInSlot() {
    if (!this.form.electionId || !this.form.organization) return [];
    return this.candidates.filter(
      (c) =>
        (c as any).electionId === this.form.electionId &&
        (c as any).organization === this.form.organization,
    );
  }
  get takenPositions(): string[] {
    return this.candidatesInSlot.map((c) => c.position);
  }
  get positionConflict(): boolean {
    if (!this.form.position || !this.form.electionId || !this.form.organization) return false;
    return this.takenPositions.includes(this.form.position);
  }
  get conflictHolder(): string {
    if (!this.positionConflict) return '';
    return this.candidatesInSlot.find((c) => c.position === this.form.position)?.name ?? '';
  }
  get slotsFilled(): number {
    return this.candidatesInSlot.length;
  }
  get slotsTotal(): number {
    return this.positionsForOrg.length;
  }

  // ── Applicants filtered by selected position ──────────────────
  // -- Approved applicants for the selected election --
  get approvedApplicants(): Application[] {
    if (!this.form.electionId) return [];
    return this.applications.filter((a) => {
      const isApproved = a.status === 'approved';
      const matchElection = (a as any).electionId === this.form.electionId;
      return isApproved && matchElection;
    });
  }

  onNameSelected(name: string): void {
    // Match on name + status=approved + must belong to the selected election
    const app = this.applications.find(
      (a) =>
        a.name === name &&
        a.status === 'approved' &&
        (a as any).electionId === this.form.electionId,
    );
    if (!app) {
      this.selectedApplication = null;
      this.form = { ...this.emptyForm(), electionId: this.form.electionId, name: '' };
      return;
    }
    // Lock this application so save() can cross-check it
    this.selectedApplication = app;
    // Auto-fill all fields from the student's own application data
    this.form.organization = (app as any).organization ?? '';
    this.form.position = app.position ?? '';
    this.form.course = (app as any).course ?? '';
    this.form.year = (app as any).year ?? '';
    this.form.party = (app as any).party ?? '';
    this.form.bio = (app as any).bio ?? '';
    // Guarantee the election on the form matches the application's electionId
    this.form.electionId = (app as any).electionId ?? this.form.electionId;
  }

  // ── Detail modal ─────────────────────────────────────────────
  openDetail(c: Candidate & { electionId?: string; organization?: string }): void {
    this.detailCandidate = c;
    this.showDetailModal = true;
  }
  closeDetail(): void {
    this.showDetailModal = false;
    this.detailCandidate = null;
  }

  // ── Register modal ────────────────────────────────────────────
  openAdd(): void {
    this.form = this.emptyForm();
    this.selectedApplication = null;
    this.showModal = true;
  }
  closeModal(): void {
    this.selectedApplication = null;
    this.showModal = false;
  }

  emptyForm() {
    return {
      name: '',
      organization: '',
      position: '',
      electionId: '',
      party: '',
      bio: '',
      course: '',
      year: '',
      status: 'approved' as const,
      votes: 0,
    };
  }
  onElectionChange(): void {
    // Reset everything except electionId when election changes
    this.selectedApplication = null;
    this.form = { ...this.emptyForm(), electionId: this.form.electionId };
  }

  // ── Save candidate (admin registers directly) ─────────────────
  // Admin-registered candidates are auto-approved and go straight
  // to the candidates collection (and thus the ballot).
  save(): void {
    if (!this.form.name.trim()) {
      Swal.fire('Missing field', 'Full Name is required.', 'warning');
      return;
    }
    if (!this.form.organization || !this.form.position) {
      Swal.fire('Missing field', 'Please select an approved candidate first.', 'warning');
      return;
    }
    if (!this.form.electionId) {
      Swal.fire('Missing field', 'Please select an Election.', 'warning');
      return;
    }
    // Cross-validate: the selected application must belong to the chosen election
    if (this.selectedApplication) {
      const appElectionId = (this.selectedApplication as any).electionId ?? '';
      if (appElectionId && appElectionId !== this.form.electionId) {
        Swal.fire({
          icon: 'error',
          title: 'Election Mismatch',
          text: `${this.form.name} applied for "${this.electionName(appElectionId)}", not the selected election. Please select the correct election first.`,
        });
        return;
      }
    }

    if (this.positionConflict) {
      Swal.fire({
        icon: 'warning',
        title: 'Position already filled',
        text: `${this.form.position} is already assigned to ${this.conflictHolder}.`,
      });
      return;
    }

    this.saving = true;

    this.svc
      .addCandidate({
        name: this.form.name.trim(),
        position: this.form.position,
        party: this.form.party.trim(),
        votes: 0,
        bio: this.form.bio.trim(),
        course: this.form.course,
        year: this.form.year,
        status: 'approved', // admin-registered = instantly on ballot
        organization: this.form.organization,
        electionId: this.form.electionId,
        registeredAt: new Date().toISOString(),
        registeredBy: 'admin',
      } as any)
      .subscribe({
        next: () => {
          this.svc
            .addAuditLog({
              action: 'CANDIDATE_REGISTERED',
              performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
              details: `Registered ${this.form.name.trim()} as ${this.form.position} for election: ${this.electionName(this.form.electionId)}`,
              createdAt: new Date().toISOString(),
            })
            .subscribe();

          this.saving = false;
          this.closeModal();
          this.load();

          Swal.fire({
            icon: 'success',
            title: 'Candidate Registered!',
            html: `<b>${this.form.name.trim()}</b> added as <b>${this.form.position}</b>`,
            timer: 1800,
            showConfirmButton: false,
          });
        },
        error: (err) => {
          this.saving = false;
          Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        },
      });
  }

  // ── Set status (approve / disqualify on candidates tab) ───────
  setStatus(
    c: Candidate & { electionId?: string; organization?: string },
    status: 'approved' | 'disqualified',
  ): void {
    const label = status === 'approved' ? 'Approve' : 'Disqualify';
    const color = status === 'approved' ? '#22c55e' : '#ef4444';

    Swal.fire({
      title: `${label} candidate?`,
      text: c.name,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: color,
      confirmButtonText: label,
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.svc.updateCandidate({ ...c, status } as Candidate).subscribe(() => {
        this.svc
          .addAuditLog({
            action: `CANDIDATE_${status.toUpperCase()}`,
            performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
            details: `${label}d candidate ${c.name} (${c.position})`,
            targetId: c.id,
            createdAt: new Date().toISOString(),
          })
          .subscribe();
        this.load();
        Swal.fire({ icon: 'success', title: `${label}d!`, timer: 900, showConfirmButton: false });
      });
    });
  }

  // ── Delete ────────────────────────────────────────────────────
  delete(c: Candidate): void {
    Swal.fire({
      title: 'Delete candidate?',
      text: `Remove ${c.name} permanently?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.svc.deleteCandidate(c.id).subscribe(() => {
        this.svc
          .addAuditLog({
            action: 'CANDIDATE_DELETED',
            performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
            details: `Deleted candidate ${c.name} (${c.position})`,
            targetId: c.id,
            createdAt: new Date().toISOString(),
          })
          .subscribe();
        this.load();
        Swal.fire({ icon: 'success', title: 'Deleted', timer: 900, showConfirmButton: false });
      });
    });
  }

  // ── Approve application → auto-creates candidate on ballot ────
  //
  // Flow:
  //   1. Mark application as 'approved' in /applications
  //   2. addCandidateFromApplication() checks /candidates for existing
  //      applicationId — prevents duplicates if clicked twice
  //   3. New candidate doc is status:'approved' + electionId set
  //      → getCandidatesByElection() on the ballot picks it up instantly
  //   4. Notify student via /notifications
  //   5. Write audit log
  //
  approveApplication(app: Application): void {
    Swal.fire({
      title: 'Approve application?',
      html: `<b>${app.name}</b> for <b>${app.position}</b>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      confirmButtonText: 'Approve',
    }).then((r) => {
      if (!r.isConfirmed) return;

      // Step 1 — mark application approved
      this.svc.updateApplication({ ...app, status: 'approved' }).subscribe(() => {
        // Step 2 & 3 — create candidate doc (duplicate-safe)
        this.svc.addCandidateFromApplication(app).subscribe(() => {
          // Step 4 — notify student (real-time via listWhere on their side)
          this.svc
            .addNotification({
              role: 'student',
              studentId: app.studentId,
              type: 'approved',
              title: '✅ Application Approved',
              message: `Your application for ${app.position} has been approved. You are now an official candidate!`,
              createdAt: new Date().toISOString(),
              seen: false,
            })
            .subscribe();

          // Step 5 — audit log
          this.svc
            .addAuditLog({
              action: 'CANDIDATE_APPROVED',
              performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
              details: `Approved ${app.name} for ${app.position} — candidate doc created`,
              targetId: app.id,
              createdAt: new Date().toISOString(),
            })
            .subscribe();

          this.load();
          this.loadApplications();

          Swal.fire({
            icon: 'success',
            title: 'Approved!',
            text: `${app.name} is now on the ballot.`,
            timer: 1500,
            showConfirmButton: false,
          });
        });
      });
    });
  }

  // ── Reject application ────────────────────────────────────────
  rejectApplication(app: Application): void {
    Swal.fire({
      title: 'Disqualify application?',
      html: `<b>${app.name}</b> for <b>${app.position}</b>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Disqualify',
    }).then((r) => {
      if (!r.isConfirmed) return;

      this.svc.updateApplication({ ...app, status: 'rejected' }).subscribe(() => {
        this.svc
          .addNotification({
            role: 'student',
            studentId: app.studentId,
            type: 'disqualified',
            title: '❌ Application Disqualified',
            message: `Your application for ${app.position} has been disqualified.`,
            createdAt: new Date().toISOString(),
            seen: false,
          })
          .subscribe();

        this.svc
          .addAuditLog({
            action: 'CANDIDATE_DISQUALIFIED',
            performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
            details: `Disqualified ${app.name} for ${app.position}`,
            targetId: app.id,
            createdAt: new Date().toISOString(),
          })
          .subscribe();

        this.loadApplications();
        Swal.fire({ icon: 'info', title: 'Disqualified', timer: 1000, showConfirmButton: false });
      });
    });
  }
}
