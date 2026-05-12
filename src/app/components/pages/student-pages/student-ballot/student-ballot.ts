import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ElectionService, Election, Voter, Candidate } from '../../../../services/election';
import { AuthService } from '../../../../services/auth';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

export interface BallotPosition {
  name: string;
  candidates: Candidate[];
}

type BallotView = 'ballot' | 'success';

const ABSTAIN = '__ABSTAIN__';

// Preferred position order
const POSITION_ORDER = [
  'President', 'Vice President', 'Secretary', 'Treasurer',
  'Auditor', 'PRO', 'Business Manager',
  '1st Year Rep', '2nd Year Rep', '3rd Year Rep', '4th Year Rep',
  'Sergeant-at-Arms',
];

@Component({
  selector: 'app-student-ballot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-ballot.html',
  styleUrl: './student-ballot.scss',
})
export class StudentBallot implements OnInit {
  selectedElection: Election | null = null;
  positions: BallotPosition[] = [];
  voter: Voter | null = null;
  votes: Record<string, string> = {};

  /** Resolved candidate objects shown in the success summary */
  voteSummary: { position: string; candidate: Candidate | null; abstained: boolean }[] = [];

  view: BallotView = 'ballot';
  loading = true;
  ballotLoading = false;
  submitting = false;

  readonly ABSTAIN = ABSTAIN;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: ElectionService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    const electionId = this.route.snapshot.paramMap.get('id');
    const user = this.auth.getCurrentUser();

    if (!electionId) {
      this.router.navigate(['/app/student-elections']);
      return;
    }

    if (user) {
      // voters collection is keyed on studentId (e.g. "2024-0001"), not the Firebase UID
      const studentId = user.studentId ?? user.id;
      this.svc.getVoterByStudentId(studentId).subscribe((voters: Voter[]) => {
        this.voter = voters[0] ?? null;
      });
    }

    this.svc.getElectionById(electionId).subscribe((election) => {
      if (!election) {
        Swal.fire({ icon: 'error', title: 'Election not found.' });
        this.router.navigate(['/app/student-elections']);
        return;
      }

      if (election.status !== 'active') {
        Swal.fire({ icon: 'warning', title: 'This election is not active.' });
        this.router.navigate(['/app/student-elections']);
        return;
      }

      this.selectedElection = election;
      this.loading = false;
      this.loadCandidates(electionId);
    });
  }

  loadCandidates(electionId: string): void {
    this.ballotLoading = true;

    this.svc.getCandidates().subscribe((candidates: Candidate[]) => {
      const filtered = candidates.filter(
        (c) => c.status === 'approved' && c.electionId === electionId,
      );

      const list =
        filtered.length > 0 ? filtered : candidates.filter((c) => c.status === 'approved');

      const positionMap = new Map<string, Candidate[]>();
      list.forEach((c) => {
        if (!positionMap.has(c.position)) positionMap.set(c.position, []);
        positionMap.get(c.position)!.push(c);
      });

      // Sort positions by predefined order
      this.positions = Array.from(positionMap.entries())
        .sort(([a], [b]) => {
          const ai = POSITION_ORDER.indexOf(a);
          const bi = POSITION_ORDER.indexOf(b);
          if (ai === -1 && bi === -1) return a.localeCompare(b);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        })
        .map(([name, cands]) => ({ name, candidates: cands }));

      this.ballotLoading = false;
    });
  }

  // ── Getters ───────────────────────────────────────────────

  /** True if this voter's hasVoted flag is set — blocks re-voting */
  get hasVoted(): boolean {
    return this.voter?.hasVoted ?? false;
  }
  get totalPositions(): number { return this.positions.length; }
  get answeredCount(): number  { return Object.keys(this.votes).length; }
  get progressPercent(): number {
    return this.totalPositions ? (this.answeredCount / this.totalPositions) * 100 : 0;
  }
  get allAnswered(): boolean {
    return this.answeredCount === this.totalPositions && this.totalPositions > 0;
  }

  // ── Selection ─────────────────────────────────────────────

  selectCandidate(position: string, candidateId: string): void {
    if (this.hasVoted || this.view === 'success') return;
    if (this.votes[position] === candidateId) {
      const updated = { ...this.votes };
      delete updated[position];
      this.votes = updated;
    } else {
      this.votes = { ...this.votes, [position]: candidateId };
    }
  }

  toggleAbstain(position: string): void {
    if (this.hasVoted || this.view === 'success') return;
    if (this.votes[position] === ABSTAIN) {
      const updated = { ...this.votes };
      delete updated[position];
      this.votes = updated;
    } else {
      this.votes = { ...this.votes, [position]: ABSTAIN };
    }
  }

  isAbstained(position: string): boolean {
    return this.votes[position] === ABSTAIN;
  }

  // ── Submit ────────────────────────────────────────────────

  buildSummary(): void {
    const allCandidates = this.positions.flatMap((p) => p.candidates);
    this.voteSummary = this.positions.map((p) => {
      const val = this.votes[p.name];
      if (!val || val === ABSTAIN) {
        return { position: p.name, candidate: null, abstained: true };
      }
      const found = allCandidates.find((c) => c.id === val) ?? null;
      return { position: p.name, candidate: found, abstained: false };
    });
  }

  submitBallot(): void {
    if (!this.allAnswered || !this.selectedElection || !this.voter) return;

    // Double-guard: if voter already voted, do not proceed
    if (this.hasVoted) {
      Swal.fire({ icon: 'warning', title: 'You have already submitted your ballot.' });
      return;
    }

    this.submitting = true;

    // Strip abstains — only real votes increment candidate tallies
    const realVotes: Record<string, string> = {};
    for (const [pos, val] of Object.entries(this.votes)) {
      if (val !== ABSTAIN) realVotes[pos] = val;
    }

    const candidateList = this.positions.flatMap((p) => p.candidates);

    this.svc.castVote(this.voter, this.selectedElection, realVotes, candidateList).subscribe({
      next: () => {
        this.submitting = false;
        if (this.voter) this.voter = { ...this.voter, hasVoted: true };
        this.buildSummary();
        this.view = 'success';
        // Navigate to the permanent vote receipt after a short delay so the
        // success animation is visible, then student-details takes over.
        setTimeout(() => {
          this.router.navigate(['/app/student-details', this.selectedElection!.id]);
        }, 2000);
      },
      error: (err) => {
        this.submitting = false;
        Swal.fire({
          icon: 'error',
          title: 'Vote Failed',
          text: err.message || 'Something went wrong.',
        });
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  goBack(): void      { this.router.navigate(['/app/student-elections']); }
  goToResults(): void { this.router.navigate(['/app/student-elections']); }
  goHome(): void      { this.router.navigate(['/app/student-elections']); }
}