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

  view: BallotView = 'ballot';
  loading = true;
  ballotLoading = false;
  submitting = false;

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

    // load voter by user id
    if (user) {
      this.svc.getVoterByStudentId(user.id).subscribe((voters: Voter[]) => {
        this.voter = voters[0] ?? null;
      });
    }

    // load specific election
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
      // ✅ filter by approved + electionId
      const filtered = candidates.filter(
        (c) => c.status === 'approved' && (c as any).electionId === electionId,
      );

      // fallback: if no electionId stored, show all approved
      const list =
        filtered.length > 0 ? filtered : candidates.filter((c) => c.status === 'approved');

      const positionMap = new Map<string, Candidate[]>();
      list.forEach((c) => {
        if (!positionMap.has(c.position)) positionMap.set(c.position, []);
        positionMap.get(c.position)!.push(c);
      });

      this.positions = Array.from(positionMap.entries()).map(([name, cands]) => ({
        name,
        candidates: cands,
      }));

      this.ballotLoading = false;
    });
  }

  goBack(): void {
    this.router.navigate(['/app/student-elections']);
  }

  get hasVoted(): boolean {
    return this.voter?.hasVoted ?? false;
  }
  get totalPositions(): number {
    return this.positions.length;
  }
  get answeredCount(): number {
    return Object.keys(this.votes).length;
  }
  get progressPercent(): number {
    return this.totalPositions ? (this.answeredCount / this.totalPositions) * 100 : 0;
  }
  get allAnswered(): boolean {
    return this.answeredCount === this.totalPositions && this.totalPositions > 0;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

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

  submitBallot(): void {
    if (!this.allAnswered || !this.selectedElection || !this.voter) return;
    this.submitting = true;

    const candidateList = this.positions.flatMap((p) => p.candidates);

    // Filter out abstain selections so only real candidate votes are counted
    const filteredVotes: Record<string, string> = {};
    for (const [pos, val] of Object.entries(this.votes)) {
      if (val !== '__abstain__') filteredVotes[pos] = val;
    }

    this.svc.castVote(this.voter, this.selectedElection, filteredVotes, candidateList).subscribe({
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

  goToResults(): void {
    this.router.navigate(['/app/student-results']);
  }
  goHome(): void {
    this.router.navigate(['/app/student-elections']);
  }
}