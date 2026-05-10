import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Candidate, Election } from '../../../services/election';
import Swal from 'sweetalert2';

// Positions available per organization
const POSITIONS: Record<string, string[]> = {
  'ATLAS': [
    'President', 'Vice President', 'Secretary', 'Treasurer',
    'Auditor', 'PRO', 'Business Manager', '1st Year Rep',
    '2nd Year Rep', '3rd Year Rep', '4th Year Rep', 'Sergeant-at-Arms',
  ],
  'USG': [
    'President', 'Vice President', 'Secretary', 'Treasurer',
    'Auditor', 'PRO',
  ],
  'STCM': [
    'President', 'Vice President', 'Secretary', 'Treasurer',
    'Auditor', 'PRO',
  ],
  'AEMT': [
    'President', 'Vice President', 'Secretary', 'Treasurer',
    'Auditor', 'PRO',
  ],
};

const ORGANIZATIONS = Object.keys(POSITIONS);
const COURSES = ['BSIT', 'BSTCM', 'BSEMT', 'BSCS', 'BSEd', 'BSED', 'BSN', 'Other'];
const YEARS   = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

@Component({
  selector: 'app-admin-candidates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-candidates.html',
  styleUrls: ['./admin-candidates.scss'],
})
export class AdminCandidates implements OnInit {

  // ── Data ──────────────────────────────────────────────────────
  candidates: (Candidate & { electionId?: string; organization?: string })[] = [];
  elections: Election[] = [];
  loading = false;

  // ── Filter state ──────────────────────────────────────────────
  filterStatus: 'all' | 'pending' | 'approved' | 'disqualified' = 'all';
  filterOrg = '';
  filterElection = '';
  searchText = '';

  // ── Modal state ───────────────────────────────────────────────
  showModal = false;
  saving = false;

  // ── Form ──────────────────────────────────────────────────────
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

  // ── Lookups ───────────────────────────────────────────────────
  readonly orgs    = ORGANIZATIONS;
  readonly courses = COURSES;
  readonly years   = YEARS;

  constructor(private svc: ElectionService) {}

  ngOnInit(): void {
    this.load();
  }

  // ── Load ──────────────────────────────────────────────────────
  load(): void {
    this.loading = true;
    this.svc.getElections().subscribe(e => { this.elections = e; });
    this.svc.getCandidates().subscribe(c => {
      this.candidates = c as any[];
      this.loading = false;
    });
  }

  // ── Derived lists ─────────────────────────────────────────────
  get positionsForOrg(): string[] {
    return POSITIONS[this.form.organization] ?? [];
  }

  /** Only elections that can still accept candidates */
  get availableElections(): Election[] {
    return this.elections.filter(e => e.status === 'upcoming' || e.status === 'active');
  }

  /** Selected election object */
  get selectedElection(): Election | null {
    return this.elections.find(e => e.id === this.form.electionId) ?? null;
  }

  /** Candidates already in the selected election under the same org */
  get candidatesInSlot(): (Candidate & { electionId?: string; organization?: string })[] {
    if (!this.form.electionId || !this.form.organization) return [];
    return this.candidates.filter(
      c => (c as any).electionId === this.form.electionId &&
           (c as any).organization === this.form.organization
    );
  }

  /** Positions already taken in the selected election + org */
  get takenPositions(): string[] {
    return this.candidatesInSlot.map(c => c.position);
  }

  /** True if chosen position is already filled */
  get positionConflict(): boolean {
    if (!this.form.position || !this.form.electionId || !this.form.organization) return false;
    return this.takenPositions.includes(this.form.position);
  }

  /** Name of whoever holds the conflicting position */
  get conflictHolder(): string {
    if (!this.positionConflict) return '';
    return this.candidatesInSlot.find(c => c.position === this.form.position)?.name ?? '';
  }

  /** Count of positions filled vs available for the selected election + org */
  get slotsFilled(): number { return this.candidatesInSlot.length; }
  get slotsTotal(): number  { return this.positionsForOrg.length; }

  get filteredCandidates() {
    return this.candidates.filter(c => {
      const matchStatus   = this.filterStatus === 'all' || c.status === this.filterStatus;
      const matchOrg      = !this.filterOrg      || (c as any).organization === this.filterOrg;
      const matchElection = !this.filterElection || (c as any).electionId   === this.filterElection;
      const q = this.searchText.toLowerCase();
      const matchSearch   = !q || c.name.toLowerCase().includes(q) || c.position.toLowerCase().includes(q);
      return matchStatus && matchOrg && matchElection && matchSearch;
    });
  }

  get totalCount()        { return this.candidates.length; }
  get approvedCount()     { return this.candidates.filter(c => c.status === 'approved').length; }
  get pendingCount()      { return this.candidates.filter(c => c.status === 'pending').length; }
  get disqualifiedCount() { return this.candidates.filter(c => c.status === 'disqualified').length; }

  electionName(id: string): string {
    return this.elections.find(e => e.id === id)?.name ?? '—';
  }

  // ── Modal open/close ──────────────────────────────────────────
  openAdd(): void {
    this.form = this.emptyForm();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  emptyForm() {
    return {
      name: '', organization: '', position: '', electionId: '',
      party: '', bio: '', course: '', year: '', photo: '',
      status: 'approved' as const,
      votes: 0,
    };
  }

  onOrgChange(): void {
    this.form.position = '';
  }

  onElectionChange(): void {
    // Reset position when election changes so user re-picks
    this.form.position = '';
  }

  // ── Photo upload (base64) ─────────────────────────────────────
  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { this.form.photo = reader.result as string; };
    reader.readAsDataURL(file);
  }

  // ── Save ──────────────────────────────────────────────────────
  save(): void {
    if (!this.form.name.trim()) {
      Swal.fire('Missing field', 'Full Name is required.', 'warning'); return;
    }
    if (!this.form.organization) {
      Swal.fire('Missing field', 'Organization is required.', 'warning'); return;
    }
    if (!this.form.position) {
      Swal.fire('Missing field', 'Position is required.', 'warning'); return;
    }
    if (!this.form.electionId) {
      Swal.fire('Missing field', 'Please select an Election.', 'warning'); return;
    }
    if (this.positionConflict) {
      Swal.fire({
        icon: 'warning',
        title: 'Position already filled',
        text: `${this.form.position} in this election is already assigned to ${this.conflictHolder}.`,
      });
      return;
    }

    this.saving = true;

    this.svc.addCandidate({
      name:         this.form.name.trim(),
      position:     this.form.position,
      party:        this.form.party.trim(),
      photo:        this.form.photo,
      votes:        0,
      bio:          this.form.bio.trim(),
      course:       this.form.course,
      year:         this.form.year,
      status:       'approved',
      organization: this.form.organization,
      electionId:   this.form.electionId,
      registeredAt: new Date().toISOString(),
      registeredBy: 'admin',
    } as any).subscribe({
      next: () => {
        // Also update the election's positions array so the ballot builder sees it
        const election = this.selectedElection;
        if (election) {
          const existingPositions: string[] = election.positions ?? [];
          if (!existingPositions.includes(this.form.position)) {
            const updatedPositions = [...existingPositions, this.form.position];
            this.svc.updateElection({ ...election, positions: updatedPositions }).subscribe();
          }
        }

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
      error: err => {
        this.saving = false;
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
      },
    });
  }

  // ── Quick status change ───────────────────────────────────────
  setStatus(c: Candidate & { electionId?: string; organization?: string }, status: 'approved' | 'disqualified'): void {
    const label = status === 'approved' ? 'Approve' : 'Disqualify';
    const color = status === 'approved' ? '#22c55e' : '#ef4444';

    Swal.fire({
      title: `${label} candidate?`,
      text: c.name,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: color,
      confirmButtonText: label,
    }).then(r => {
      if (!r.isConfirmed) return;
      this.svc.updateCandidate({ ...c, status } as Candidate).subscribe(() => {
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
    }).then(r => {
      if (!r.isConfirmed) return;
      this.svc.deleteCandidate(c.id).subscribe(() => {
        this.load();
        Swal.fire({ icon: 'success', title: 'Deleted', timer: 900, showConfirmButton: false });
      });
    });
  }

  // ── UI helpers ────────────────────────────────────────────────
  statusClass(s?: string) {
    return s === 'approved' ? 'badge-approved' : s === 'pending' ? 'badge-pending' : 'badge-disqualified';
  }

  isPositionTaken(pos: string): boolean {
    return this.takenPositions.includes(pos);
  }

  initial(name: string): string {
    return name?.charAt(0)?.toUpperCase() ?? '?';
  }
}