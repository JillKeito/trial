import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ElectionService, Election, Voter, Candidate } from '../../../../services/election';
import { AuthService } from '../../../../services/auth';
import { FormsModule } from '@angular/forms';

export const ABSTAIN_ID = '__abstain__';

export interface BallotPosition {
  name: string;
  candidates: Candidate[];
}

type BallotView = 'select-election' | 'ballot' | 'success';

@Component({
  selector: 'app-student-ballot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-ballot.html',
  styleUrl: './student-ballot.scss',
})
export class StudentBallot implements OnInit {
  elections: Election[] = [];
  selectedElection: Election | null = null;
  positions: BallotPosition[] = [];
  voter: Voter | null = null;
  votes: Record<string, string> = {};

  studentOrgs: string[] = [];

  view: BallotView = 'select-election';
  loading = true;
  ballotLoading = false;
  submitting = false;

  /** Expose constant to template */
  readonly ABSTAIN_ID = ABSTAIN_ID;

  constructor(
    private router: Router,
    private svc: ElectionService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();

    if (user) {
      this.svc.getVoterByStudentId(user.id).subscribe((voters: Voter[]) => {
        this.voter = voters[0] ?? null;

        const v = voters[0] as any;
        if (v?.organizations && Array.isArray(v.organizations)) {
          this.studentOrgs = v.organizations;
        } else if (v?.organization) {
          this.studentOrgs = [v.organization];
        } else if (v?.course) {
          this.studentOrgs = [v.course];
        } else {
          this.studentOrgs = [];
        }
      });
    }

    this.svc.getElections().subscribe((elections: Election[]) => {
      this.elections = elections.filter((e) => e.status === 'active');
      this.loading = false;
    });
  }

  selectElection(election: Election): void {
    this.selectedElection = election;
    this.votes = {};
    this.view = 'ballot';
    this.ballotLoading = true;

    this.svc.getCandidatesByElection(election.id).subscribe((candidates: Candidate[]) => {
      const approved = candidates.filter((c) => c.status === 'approved');
      const positionMap = new Map<string, Candidate[]>();

      approved.forEach((c) => {
        if (!positionMap.has(c.position)) positionMap.set(c.position, []);
        positionMap.get(c.position)!.push(c);
      });

      const orderedPositions: string[] = election.positions ?? [];
      if (orderedPositions.length > 0) {
        this.positions = orderedPositions
          .filter((p) => positionMap.has(p))
          .map((name) => ({ name, candidates: positionMap.get(name)! }));
      } else {
        this.positions = Array.from(positionMap.entries()).map(([name, cands]) => ({
          name,
          candidates: cands,
        }));
      }

      this.ballotLoading = false;
    });
  }

  backToSelection(): void {
    this.selectedElection = null;
    this.positions = [];
    this.votes = {};
    this.view = 'select-election';
  }

  getCandidatePhoto(c: Candidate): string {
    return c.photo ?? '';
  }

  get hasVoted(): boolean { return this.voter?.hasVoted ?? false; }
  get totalPositions(): number { return this.positions.length; }

  /** Count positions where a real candidate OR abstain has been selected */
  get answeredCount(): number { return Object.keys(this.votes).length; }

  /** Count positions where student chose to abstain */
  get abstainCount(): number {
    return Object.values(this.votes).filter(v => v === ABSTAIN_ID).length;
  }

  /** Count positions where student picked a real candidate */
  get votedCount(): number { return this.answeredCount - this.abstainCount; }

  get progressPercent(): number {
    return this.totalPositions ? (this.answeredCount / this.totalPositions) * 100 : 0;
  }

  get allAnswered(): boolean {
    return this.answeredCount === this.totalPositions && this.totalPositions > 0;
  }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  }

  selectCandidate(position: string, candidateId: string): void {
    if (this.hasVoted || this.view === 'success') return;
    // Toggle off if already selected
    if (this.votes[position] === candidateId) {
      const updated = { ...this.votes };
      delete updated[position];
      this.votes = updated;
    } else {
      this.votes = { ...this.votes, [position]: candidateId };
    }
  }

  isSelected(position: string, candidateId: string): boolean {
    return this.votes[position] === candidateId;
  }

  isAbstained(position: string): boolean {
    return this.votes[position] === ABSTAIN_ID;
  }

  submitBallot(): void {
    if (!this.allAnswered || !this.selectedElection || !this.voter) return;
    this.submitting = true;

    // Only pass real votes (not abstains) to castVote so tallies are accurate
    const realVotes: Record<string, string> = {};
    for (const [pos, cId] of Object.entries(this.votes)) {
      if (cId !== ABSTAIN_ID) realVotes[pos] = cId;
    }

    // Full votes map (including abstains) saved to the vote record for audit
    const allVotes = { ...this.votes };

    const candidateList: Candidate[] = this.positions.flatMap((p) => p.candidates);

    this.svc.castVote(this.voter, this.selectedElection, realVotes, allVotes, candidateList).subscribe({
      next: () => {
        this.submitting = false;
        if (this.voter) this.voter = { ...this.voter, hasVoted: true };
        this.view = 'success';
      },
      error: (err) => {
        this.submitting = false;
        console.error('Vote error:', err);
        alert('Something went wrong. Please try again.');
      },
    });
  }

  goHome(): void { this.router.navigate(['/app/student-elections']); }
  goToResults(): void { this.router.navigate(['/app/student-elections']); }
}