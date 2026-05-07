import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Election, Candidate } from '../../../../services/election';
import Swal from 'sweetalert2';

export interface BallotCandidate extends Candidate {
  ballotPosition?: string;
}

@Component({
  selector: 'app-ballot-creator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ballot-creator.html',
  styleUrl: './ballot-creator.scss',
})
export class BallotCreator implements OnInit {
  elections: Election[] = [];
  allCandidates: BallotCandidate[] = [];

  selectedElectionId: string | null = null;
  selectedElection: Election | null = null;

  positions: string[] = [
    'President',
    'Vice President',
    'Secretary',
    'Treasurer',
    'Auditor',
    'PRO / PIO',
    'Senator',
  ];

  // assignment map: candidateId → ballotPosition
  assignments: Record<string, string> = {};
  assignTarget: Record<string, string> = {};

  searchQuery = '';
  newPositionName = '';
  showAddPosition = false;
  loading = false;
  publishing = false;
  isDirty = false;

  constructor(private svc: ElectionService) {}

  ngOnInit(): void {
    this.svc.getElections().subscribe((e) => (this.elections = e));
  }

  onElectionChange(): void {
    this.selectedElection = this.elections.find((e) => e.id === this.selectedElectionId) ?? null;
    this.loading = true;
    this.assignments = {};
    this.assignTarget = {};
    this.isDirty = false;

    this.svc.getCandidates().subscribe((candidates) => {
      this.allCandidates = candidates
        .filter((c) => c.status === 'approved')
        .map((c) => ({ ...c }));
      this.loading = false;
    });
  }

  // ── Candidates ────────────────────────────────────────────

  get approvedCandidates(): BallotCandidate[] {
    return this.allCandidates;
  }

  get assignedCandidates(): BallotCandidate[] {
    return this.allCandidates.filter((c) => !!this.assignments[c.id]);
  }

  get unassignedCandidates(): BallotCandidate[] {
    return this.allCandidates.filter((c) => !this.assignments[c.id]);
  }

  get filteredUnassigned(): BallotCandidate[] {
    const q = this.searchQuery.toLowerCase();
    return this.unassignedCandidates.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.party.toLowerCase().includes(q) ||
        c.position.toLowerCase().includes(q),
    );
  }

  getCandidatesForPosition(pos: string): BallotCandidate[] {
    return this.allCandidates.filter((c) => this.assignments[c.id] === pos);
  }

  assignCandidate(c: BallotCandidate): void {
    const target = this.assignTarget[c.id];
    if (!target) return;
    this.assignments = { ...this.assignments, [c.id]: target };
    delete this.assignTarget[c.id];
    this.isDirty = true;
  }

  unassignCandidate(c: BallotCandidate): void {
    const updated = { ...this.assignments };
    delete updated[c.id];
    this.assignments = updated;
    this.isDirty = true;
  }

  // ── Positions ─────────────────────────────────────────────

  addPosition(): void {
    this.showAddPosition = true;
  }

  confirmAddPosition(): void {
    const name = this.newPositionName.trim();
    if (!name) return;
    if (this.positions.includes(name)) {
      Swal.fire({ icon: 'warning', title: 'Position already exists', text: `"${name}" is already on the ballot.` });
      return;
    }
    this.positions = [...this.positions, name];
    this.newPositionName = '';
    this.showAddPosition = false;
    this.isDirty = true;
  }

  cancelAddPosition(): void {
    this.newPositionName = '';
    this.showAddPosition = false;
  }

  removePosition(pos: string): void {
    const count = this.getCandidatesForPosition(pos).length;
    if (count > 0) {
      Swal.fire({
        title: `Remove "${pos}"?`,
        text: `${count} candidate(s) will become unassigned.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Remove',
        confirmButtonColor: '#dc3545',
      }).then((r) => {
        if (r.isConfirmed) {
          this.positions = this.positions.filter((p) => p !== pos);
          // unassign all candidates from removed position
          const updated = { ...this.assignments };
          Object.keys(updated).forEach((id) => {
            if (updated[id] === pos) delete updated[id];
          });
          this.assignments = updated;
          this.isDirty = true;
        }
      });
    } else {
      this.positions = this.positions.filter((p) => p !== pos);
      this.isDirty = true;
    }
  }

  // ── Stats ─────────────────────────────────────────────────

  get assignedCount(): number {
    return Object.keys(this.assignments).length;
  }

  get unassignedCount(): number {
    return this.allCandidates.length - this.assignedCount;
  }

  get progressPercent(): number {
    if (!this.allCandidates.length) return 0;
    return Math.round((this.assignedCount / this.allCandidates.length) * 100);
  }

  get canPublish(): boolean {
    return this.positions.length > 0 && this.allCandidates.length > 0 && this.unassignedCount === 0;
  }

  // ── Actions ───────────────────────────────────────────────

  resetBallot(): void {
    Swal.fire({
      title: 'Reset ballot?',
      text: 'All assignments will be cleared.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reset',
      confirmButtonColor: '#dc3545',
    }).then((r) => {
      if (r.isConfirmed) {
        this.assignments = {};
        this.assignTarget = {};
        this.isDirty = false;
      }
    });
  }

  publishBallot(): void {
    if (!this.canPublish || !this.selectedElection) return;

    Swal.fire({
      title: 'Publish Ballot?',
      html: `This will finalize the ballot for <strong>${this.selectedElection.name}</strong> and make it visible to voters.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Publish',
      confirmButtonColor: '#3d4eac',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.publishing = true;

      // Update each candidate's position to match the ballot assignment
      const updates = this.allCandidates.map((c) => {
        const ballotPos = this.assignments[c.id];
        return this.svc.updateCandidate({ ...c, position: ballotPos ?? c.position });
      });

      import('rxjs').then(({ forkJoin }) => {
        forkJoin(updates).subscribe({
          next: () => {
            this.publishing = false;
            this.isDirty = false;
            Swal.fire({
              icon: 'success',
              title: 'Ballot Published!',
              text: 'The ballot is now live for voters.',
              confirmButtonColor: '#3d4eac',
            });
          },
          error: () => {
            this.publishing = false;
            Swal.fire({ icon: 'error', title: 'Error', text: 'Something went wrong. Please try again.' });
          },
        });
      });
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }
}