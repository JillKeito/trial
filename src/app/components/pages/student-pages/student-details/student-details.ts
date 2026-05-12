import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ElectionService, Election, Candidate, VoteRecord } from '../../../../services/election';
import { AuthService } from '../../../../services/auth';

export interface VoteSummaryRow {
  position: string;
  candidate: Candidate | null;
  abstained: boolean;
}

@Component({
  selector: 'app-student-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-details.html',
  styleUrl: './student-details.scss',
})
export class StudentDetails implements OnInit {
  election: Election | null = null;
  record: VoteRecord | null = null;
  summary: VoteSummaryRow[] = [];

  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: ElectionService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    const electionId = this.route.snapshot.paramMap.get('id');
    const user = this.auth.getCurrentUser();

    if (!electionId || !user) {
      this.router.navigate(['/app/student-elections']);
      return;
    }

    // Load election + vote record + candidates in parallel
    let electionDone = false;
    let recordDone = false;
    let candidatesDone = false;

    let candidates: Candidate[] = [];

    const tryBuild = () => {
      if (!electionDone || !recordDone || !candidatesDone) return;

      if (!this.election) {
        this.error = 'Election not found.';
        this.loading = false;
        return;
      }

      if (!this.record) {
        // Student hasn't voted yet — send them to the ballot
        this.router.navigate(['/app/student-ballot', electionId]);
        return;
      }

      // Build the summary rows from the vote record
      // Collect all unique positions from candidates for this election
      const positions = [...new Set(candidates.map((c) => c.position))];

      this.summary = positions.map((pos) => {
        const candidateId = this.record!.votes[pos];
        if (!candidateId) {
          return { position: pos, candidate: null, abstained: true };
        }
        const found = candidates.find((c) => c.id === candidateId) ?? null;
        return { position: pos, candidate: found, abstained: false };
      });

      this.loading = false;
    };

    // 1. Fetch election
    this.svc.getElectionById(electionId).subscribe((el) => {
      this.election = el;
      electionDone = true;
      tryBuild();
    });

    // 2. Fetch this student's vote record for this election
    // voteRecords stores studentId (e.g. "2024-0001"), not the Firebase UID
    const studentId = user.studentId ?? user.id;
    this.svc.getVoteRecordByStudentId(studentId).subscribe((records) => {
      this.record = records.find((r) => r.electionId === electionId) ?? null;
      recordDone = true;
      tryBuild();
    });

    // 3. Fetch candidates for this election
    this.svc.getCandidatesByElection(electionId).subscribe((cands) => {
      candidates = cands;
      candidatesDone = true;
      tryBuild();
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

  get votedCount(): number {
    return this.summary.filter((r) => !r.abstained).length;
  }

  get abstainedCount(): number {
    return this.summary.filter((r) => r.abstained).length;
  }

  goBack(): void {
    this.router.navigate(['/app/student-elections']);
  }
}