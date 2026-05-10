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

// Sentinel value for Abstain choice
const ABSTAIN_ID = '__ABSTAIN__';

// Preferred position order per org
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
  expandedPlatform: string | null = null;

  view: BallotView = 'ballot';
  loading = true;
  ballotLoading = false;
  submitting = false;

  readonly ABSTAIN_ID = ABSTAIN_ID;

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
      this.svc.getVoterByStudentId(user.id).subscribe((voters: Voter[]) => {
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
      // Filter: approved + matching electionId
      const filtered = candidates.filter(
        (c) => c.status === 'approved' && c.electionId === electionId,
      );

      // Fallback: if none match electionId, show all approved
      const list =
        filtered.length > 0
          ? filtered
          : candidates.filter((c) => c.status === 'approved');

      // Group by position
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

  // -- Selection ------------------------------------------------
  selectCandidate(position: string, candidateId: string): void {
    if (this.hasVoted || this.view === 'success') return;
    // Toggle off if same choice tapped again
    if (this.votes[position] === candidateId) {
      const updated = { ...this.votes };
      delete updated[position];
      this.votes = updated;
    } else {
      this.votes = { ...this.votes, [position]: candidateId };
    }
  }

  selectAbstain(position: string): void {
    this.selectCandidate(position, ABSTAIN_ID);
  }

  isSelected(position: string, candidateId: string): boolean {
    return this.votes[position] === candidateId;
  }

  isAbstainSelected(position: string): boolean {
    return this.votes[position] === ABSTAIN_ID;
  }

  togglePlatform(candidateId: string): void {
    this.expandedPlatform = this.expandedPlatform === candidateId ? null : candidateId;
  }

  // -- Progress -------------------------------------------------
  get hasVoted(): boolean      { return this.voter?.hasVoted ?? false; }
  get totalPositions(): number { return this.positions.length; }
  get answeredCount(): number  { return Object.keys(this.votes).length; }
  get progressPercent(): number {
    return this.totalPositions ? (this.answeredCount / this.totalPositions) * 100 : 0;
  }
  get allAnswered(): boolean {
    return this.answeredCount === this.totalPositions && this.totalPositions > 0;
  }

  // -- Submit ---------------------------------------------------
  submitBallot(): void {
    if (!this.allAnswered || !this.selectedElection || !this.voter) return;
    this.submitting = true;

    // Strip abstain votes — they don't add to any candidate's tally
    const realVotes: Record<string, string> = {};
    for (const [pos, cId] of Object.entries(this.votes)) {
      if (cId !== ABSTAIN_ID) realVotes[pos] = cId;
    }

    const candidateList = this.positions.flatMap((p) => p.candidates);

    this.svc.castVote(this.voter, this.selectedElection, realVotes, candidateList).subscribe({
      next: () => {
        this.submitting = false;
        if (this.voter) this.voter = { ...this.voter, hasVoted: true };
        this.view = 'success';
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

  // -- Helpers --------------------------------------------------
  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  getPhoto(c: Candidate): string | null {
    return (c as any).photo || null;
  }

  getBio(c: Candidate): string {
    return (c as any).bio || '';
  }

  goBack(): void    { this.router.navigate(['/app/student-elections']); }
  goToResults(): void { this.router.navigate(['/app/student-results']); }
  goHome(): void    { this.router.navigate(['/app/student-elections']); }
}