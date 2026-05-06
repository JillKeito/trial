import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ElectionService, Election, Voter } from '../../../../services/election';
import { AuthService } from '../../../../services/auth';
import { FormsModule } from '@angular/forms';

export interface Candidate {
  id: string;
  name: string;
  party: string;
  course?: string;
  year?: number;
}

export interface BallotPosition {
  name: string;
  candidates: Candidate[];
}

@Component({
  selector: 'app-student-ballot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-ballot.html',
  styleUrl: './student-ballot.scss',
})
export class StudentBallot implements OnInit {
  election: Election | null = null;
  positions: BallotPosition[] = [];
  voter: Voter | null = null;
  votes: Record<string, string> = {};
  loading = true;
  submitting = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: ElectionService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const user = this.auth.getCurrentUser();

    if (!id || !user) {
      this.loading = false;
      return;
    }

    // ✅ id stays as string — Firestore uses string IDs
    this.svc.getElectionById(id).subscribe((election) => {
      this.election = election;
    });

    this.svc.getVoterByStudentId(user.email).subscribe((voters: Voter[]) => {
      this.voter = voters[0] ?? null;
    });

    this.svc.getCandidatesByElection(id).subscribe((candidates: any[]) => {
      const positionMap = new Map<string, Candidate[]>();

      candidates.forEach((c: any) => {
        if (!positionMap.has(c.position)) {
          positionMap.set(c.position, []);
        }
        positionMap.get(c.position)!.push({
          id: String(c.id),
          name: c.name,
          party: c.party,
          course: c.course,
          year: c.year,
        });
      });

      this.positions = Array.from(positionMap.entries()).map(([name, cands]) => ({
        name,
        candidates: cands,
      }));

      this.loading = false;
    });
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

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  selectCandidate(position: string, candidateId: string): void {
    if (this.hasVoted) return;
    if (this.votes[position] === candidateId) {
      const updated = { ...this.votes };
      delete updated[position];
      this.votes = updated;
    } else {
      this.votes = { ...this.votes, [position]: candidateId };
    }
  }

  submitBallot(): void {
    if (this.answeredCount < this.totalPositions || !this.election || !this.voter) return;
    this.submitting = true;

    this.svc.castVote(this.voter, this.election, this.votes, []).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/app/student-results']);
      },
      error: () => {
        this.submitting = false;
        alert('Something went wrong. Please try again.');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/app/student-elections']);
  }
  goToResults(): void {
    this.router.navigate(['/app/student-results']);
  }
}
