import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ElectionService, Election, Candidate, VoteRecord } from '../../../../services/election';
import { AuthService } from '../../../../services/auth';

interface VoteHistoryItem {
  position: string;
  candidateName: string;
  party: string;
  abstained: boolean;
}

interface ElectionHistory {
  election: Election;
  items: VoteHistoryItem[];
}

@Component({
  selector: 'app-student-elections',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-elections.html',
  styleUrl: './student-elections.scss',
})
export class StudentElections implements OnInit {
  elections: Election[] = [];
  loading = true;

  /** Track which elections this student has already voted in */
  votedElectionIds = new Set<string>();

  /** History modal state */
  historyModal: ElectionHistory | null = null;
  historyLoading = false;

  constructor(
    private svc: ElectionService,
    private router: Router,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.svc.getElections().subscribe((elections) => {
      this.elections = elections;
      this.loading = false;
    });

    // Load the student's vote records so we know which elections they've voted in
    const user = this.auth.getCurrentUser();
    if (user) {
      // voteRecords stores studentId (e.g. "2024-0001"), not the Firebase UID
      const studentId = user.studentId ?? user.id;
      this.svc.getVoteRecordByStudentId(studentId).subscribe((records: VoteRecord[]) => {
        this.votedElectionIds = new Set(records.map((r) => r.electionId));
      });
    }
  }

  goToBallot(election: Election): void {
    this.router.navigate(['/app/student-ballot', election.id]);
  }

  /** Navigate to the permanent vote receipt for a completed vote */
  goToDetails(election: Election): void {
    this.router.navigate(['/app/student-details', election.id]);
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      active: 'Active',
      upcoming: 'Upcoming',
      completed: 'Completed',
    };
    return map[status] ?? status;
  }

  /** True if the election is active AND the student has NOT yet voted */
  canVote(election: Election): boolean {
    return election.status === 'active' && !this.votedElectionIds.has(election.id);
  }

  /** True if the election is active but the student HAS already voted */
  hasVotedIn(election: Election): boolean {
    return election.status === 'active' && this.votedElectionIds.has(election.id);
  }

  // ── History Modal ──────────────────────────────────────────

  openHistory(election: Election): void {
    this.historyLoading = true;
    this.historyModal = { election, items: [] };

    const user = this.auth.getCurrentUser();
    if (!user) {
      this.historyLoading = false;
      return;
    }

    const studentId = user.studentId ?? user.id;

    let record: VoteRecord | null = null;
    let candidates: Candidate[] = [];
    let done = 0;

    const tryBuild = () => {
      done++;
      if (done < 2) return;
      if (!record) {
        this.historyModal = {
          election,
          items: [
            { position: 'No vote record found', candidateName: '', party: '', abstained: false },
          ],
        };
        this.historyLoading = false;
        return;
      }

      const items: VoteHistoryItem[] = Object.entries(record.votes).map(([pos, cId]) => {
        if (!cId) {
          return { position: pos, candidateName: 'Abstained', party: '', abstained: true };
        }
        const cand = candidates.find((c) => c.id === cId);
        return {
          position: pos,
          candidateName: cand?.name ?? 'Unknown Candidate',
          party: cand?.party ?? '',
          abstained: false,
        };
      });

      this.historyModal = { election, items };
      this.historyLoading = false;
    };

    this.svc.getVoteRecordByStudentId(studentId).subscribe((records) => {
      record = records.find((r) => r.electionId === election.id) ?? null;
      tryBuild();
    });

    this.svc.getCandidatesByElection(election.id).subscribe((cands) => {
      candidates = cands;
      tryBuild();
    });
  }

  closeHistory(): void {
    this.historyModal = null;
  }
}