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

const ABSTAIN = '__ABSTAIN__';

const POSITION_ORDER = [
  'President', 'Vice President', 'Secretary', 'Treasurer',
  'Auditor', 'PRO', 'Business Manager',
  '1st Year Rep', '2nd Year Rep', '3rd Year Rep', '4th Year Rep',
  'Sergeant-at-Arms',
];

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

    // Use studentId (e.g. "2024-0001") — voteRecords are keyed by studentId, not uid
    const lookupId = (user as any).studentId ?? user.id;

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
        // Student hasn't voted — redirect to ballot
        this.router.navigate(['/app/student-ballot', electionId]);
        return;
      }

      // Build summary — positions from candidates list, sorted by POSITION_ORDER
      const positions = [...new Set(candidates.map((c) => c.position))].sort((a, b) => {
        const ai = POSITION_ORDER.indexOf(a);
        const bi = POSITION_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

      this.summary = positions.map((pos) => {
        const candidateId = this.record!.votes[pos];

        // Abstained if: value is __ABSTAIN__ constant, empty, or missing
        if (!candidateId || candidateId === ABSTAIN) {
          return { position: pos, candidate: null, abstained: true };
        }

        const found = candidates.find((c) => c.id === candidateId) ?? null;
        return { position: pos, candidate: found, abstained: false };
      });

      this.loading = false;
    };

    this.svc.getElectionById(electionId).subscribe((el) => {
      this.election = el;
      electionDone = true;
      tryBuild();
    });

    this.svc.getVoteRecordByStudentId(lookupId).subscribe((records) => {
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
    return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  }

  get votedCount():    number { return this.summary.filter((r) => !r.abstained).length; }
  get abstainedCount(): number { return this.summary.filter((r) => r.abstained).length; }

  goBack(): void { this.router.navigate(['/app/student-elections']); }
}