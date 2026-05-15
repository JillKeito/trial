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
  activeTab: 'candidates' | 'applications' = 'candidates';
  candidates: (Candidate & { electionId?: string; organization?: string })[] = [];
  elections: Election[] = [];
  loading = false;
  applications: Application[] = [];
  loadingApps = false;
  appFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'pending';
  filterStatus: 'all' | 'pending' | 'approved' | 'disqualified' = 'all';
  filterOrg = '';
  filterElection = '';
  searchText = '';
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
    photo: string;
    status: 'pending' | 'approved' | 'disqualified';
    votes: number;
  } = this.emptyForm();

  readonly orgs = ORGANIZATIONS;
  readonly courses = COURSES;
  readonly years = YEARS;

  constructor(
    private svc: ElectionService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadApplications();
  }

  // ── Data loading ─────────────────────────────────────────────

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

  // ── Getters ──────────────────────────────────────────────────

  get filteredApplications(): Application[] {
    if (this.appFilter === 'all') return this.applications;
    return this.applications.filter((a) => a.status === this.appFilter);
  }

  get pendingAppCount(): number {
    return this.applications.filter((a) => a.status === 'pending').length;
  }

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
  get slotsFilled(): number {
    return this.candidatesInSlot.length;
  }
  get slotsTotal(): number {
    return this.positionsForOrg.length;
  }

  get positionConflict(): boolean {
    if (!this.form.position || !this.form.electionId || !this.form.organization) return false;
    return this.takenPositions.includes(this.form.position);
  }

  get conflictHolder(): string {
    if (!this.positionConflict) return '';
    return this.candidatesInSlot.find((c) => c.position === this.form.position)?.name ?? '';
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

  // ── NEW: Avatar background color ─────────────────────────────
  avatarBg(index: number): string {
    const colors = [
      '#dbeafe', // blue
      '#dcfce7', // green
      '#fce7f3', // pink
      '#fef3c7', // yellow
      '#ede9fe', // purple
      '#ffedd5', // orange
    ];
    return colors[index % colors.length];
  }

  statusClass(s?: string): string {
    return s === 'approved'
      ? 'badge-approved'
      : s === 'pending'
        ? 'badge-pending'
        : 'badge-disqualified';
  }

  appStatusClass(s?: string): string {
    return s === 'approved'
      ? 'badge-approved'
      : s === 'rejected'
        ? 'badge-disqualified'
        : 'badge-pending';
  }

  isPositionTaken(pos: string): boolean {
    return this.takenPositions.includes(pos);
  }

  // ── Modal ────────────────────────────────────────────────────

  openAdd(): void {
    this.form = this.emptyForm();
    this.showModal = true;
  }
  closeModal(): void {
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
      photo: '',
      status: 'approved' as const,
      votes: 0,
    };
  }

  onOrgChange(): void {
    this.form.position = '';
  }
  onElectionChange(): void {
    this.form.position = '';
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.form.photo = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ── Save (register candidate) ────────────────────────────────

  save(): void {
    if (!this.form.name.trim()) {
      Swal.fire('Missing field', 'Full Name is required.', 'warning');
      return;
    }
    if (!this.form.organization) {
      Swal.fire('Missing field', 'Organization is required.', 'warning');
      return;
    }
    if (!this.form.position) {
      Swal.fire('Missing field', 'Position is required.', 'warning');
      return;
    }
    if (!this.form.electionId) {
      Swal.fire('Missing field', 'Please select an Election.', 'warning');
      return;
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
        photo: this.form.photo,
        votes: 0,
        bio: this.form.bio.trim(),
        course: this.form.course,
        year: this.form.year,
        status: 'approved',
        organization: this.form.organization,
        electionId: this.form.electionId,
        registeredAt: new Date().toISOString(),
        registeredBy: 'admin',
      } as any)
      .subscribe({
        next: () => {
          const election = this.selectedElection;
          if (election) {
            const existingPositions: string[] = election.positions ?? [];
            if (!existingPositions.includes(this.form.position)) {
              this.svc
                .updateElection({
                  ...election,
                  positions: [...existingPositions, this.form.position],
                })
                .subscribe();
            }
          }

          // ── Audit log ──
          this.svc
            .addAuditLog({
              action: 'CANDIDATE_REGISTERED',
              performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
              details: `Registered ${this.form.name.trim()} as ${this.form.position}`,
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

  // ── Approve application ──────────────────────────────────────

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
      this.svc.updateApplication({ ...app, status: 'approved' }).subscribe(() => {
        this.svc
          .addCandidate({
            name: app.name,
            position: app.position,
            party: app.party || 'Independent',
            photo: app.photo || '',
            votes: 0,
            bio: app.bio || '',
            course: app.course,
            year: app.year,
            status: 'approved',
            electionId: app.electionId,
            requirements: app.requirements,
            registeredAt: new Date().toISOString(),
            registeredBy: 'admin-from-application',
          } as any)
          .subscribe(() => {
            // ── Audit log ──
            this.svc
              .addAuditLog({
                action: 'CANDIDATE_APPROVED',
                performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
                details: `Approved ${app.name} for ${app.position}`,
                targetId: app.id,
                createdAt: new Date().toISOString(),
              })
              .subscribe();

            // ── Notify student ──
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

            this.load();
            this.loadApplications();
            Swal.fire({
              icon: 'success',
              title: 'Approved!',
              text: `${app.name} is now a candidate.`,
              timer: 1500,
              showConfirmButton: false,
            });
          });
      });
    });
  }

  // ── Reject application ───────────────────────────────────────

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
        // ── Audit log ──
        this.svc
          .addAuditLog({
            action: 'CANDIDATE_DISQUALIFIED',
            performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
            details: `Disqualified ${app.name} for ${app.position}`,
            targetId: app.id,
            createdAt: new Date().toISOString(),
          })
          .subscribe();

        // ── Notify student ──
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

        this.loadApplications();
        Swal.fire({ icon: 'info', title: 'Disqualified', timer: 1000, showConfirmButton: false });
      });
    });
  }

  // ── Set status (approve / disqualify existing candidate) ─────

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
        // ── Audit log ──
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

  // ── Delete candidate ─────────────────────────────────────────

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
        // ── Audit log ──
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
}
