import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Candidate, Election, ElectionService, VoteRecord } from '../../../services/election';
import { AuthService } from '../../../services/auth';

export interface VoteSummaryRow {
  position: string;
  candidate: Candidate | null;
  abstained: boolean;
}

@Component({
  selector: 'app-student-details',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './student-details.html',
  styleUrl: './student-details.scss',
})
export class StudentDetails implements OnInit {
  election: Election | null = null;
  record: VoteRecord | null = null;
  summary: VoteSummaryRow[] = [];

  loading = true;
  error = '';

  /** True when navigating here directly after submitting a ballot */
  justVoted = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: ElectionService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    const electionId = this.route.snapshot.paramMap.get('id');
    const user = this.auth.getCurrentUser();

    this.justVoted = this.route.snapshot.queryParamMap.get('fromBallot') === 'true';

    if (!electionId || !user) {
      this.router.navigate(['/app/student-elections']);
      return;
    }

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
        if (this.justVoted) {
          // Vote was just cast but Firestore hasn't propagated the record yet —
          // show the confirmation banner and let the user go back manually.
          this.loading = false;
          return;
        }
        // Genuinely no vote record: redirect to ballot if active, else error
        if (this.election.status === 'active') {
          this.router.navigate(['/app/student-ballot', electionId]);
        } else {
          this.error = 'No vote record found for this election.';
          this.loading = false;
        }
        return;
      }

      // Build summary using the vote record's own keys so abstained positions
      // (stored as '_abstain_' or missing) are always included.
      const orderedPositions: string[] = (this.election as any).positions?.length
        ? (this.election as any).positions
        : Object.keys(this.record.votes);

      this.summary = orderedPositions.map((pos) => {
        const chosenId = this.record!.votes[pos];
        if (!chosenId || chosenId === '_abstain_' || chosenId === '__ABSTAIN__') {
          return { position: pos, candidate: null, abstained: true };
        }
        const found = candidates.find((c) => c.id === chosenId) ?? null;
        return { position: pos, candidate: found, abstained: false };
      });

      this.loading = false;
    };

    this.svc.getElectionById(electionId).subscribe((el) => {
      this.election = el ?? null;
      electionDone = true;
      tryBuild();
    });

    const studentId = (user as any).studentId ?? user.id;
    this.svc.getVoteRecordByStudentId(studentId).subscribe((records) => {
      this.record = records.find((r) => r.electionId === electionId) ?? null;
      recordDone = true;
      tryBuild();
    });

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
