import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Candidate, Election, VoteRecord } from '../../../../services/election';

interface PositionResult {
  position: string;
  candidates: Candidate[];
  totalVotes: number;
  abstainCount: number;
}

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './results.html',
  styleUrl: './results.scss',
})
export class Results implements OnInit {

  elections: Election[] = [];
  selectedElectionId = '';
  candidates: Candidate[] = [];
  voteRecords: VoteRecord[] = [];
  loading = false;

  constructor(private svc: ElectionService) {}

  ngOnInit(): void {
    this.loading = true;
    this.svc.getElections().subscribe(elections => {
      this.elections = elections.filter(e => e.approvalStatus === 'approved');
      // Default to first active or completed election
      const active = this.elections.find(e => e.status === 'active' || e.status === 'completed');
      if (active) this.selectedElectionId = active.id;
      this.loadData();
    });
  }

  loadData(): void {
    this.svc.getCandidates().subscribe(c => {
      this.candidates = c;
      this.svc.getVoteRecords().subscribe(records => {
        this.voteRecords = records;
        this.loading = false;
      });
    });
  }

  get selectedElection(): Election | null {
    return this.elections.find(e => e.id === this.selectedElectionId) || null;
  }

  get resultsByPosition(): PositionResult[] {
    if (!this.selectedElectionId) return [];

    // Candidates for this election only
    const electionCandidates = this.candidates.filter(
      c => c.status === 'approved' && c.electionId === this.selectedElectionId
    );

    // Vote records for this election
    const electionRecords = this.voteRecords.filter(r => r.electionId === this.selectedElectionId);

    // Group by position
    const map = new Map<string, Candidate[]>();
    for (const c of electionCandidates) {
      if (!map.has(c.position)) map.set(c.position, []);
      map.get(c.position)!.push(c);
    }

    return Array.from(map.entries()).map(([position, cands]) => {
      // Count votes per candidate from vote records
      const voteCounts: Record<string, number> = {};
      let abstainCount = 0;

      for (const record of electionRecords) {
        const vote = record.votes[position];
        if (!vote || vote === '__abstain__') {
          abstainCount++;
        } else {
          voteCounts[vote] = (voteCounts[vote] || 0) + 1;
        }
      }

      const enriched = cands.map(c => ({
        ...c,
        votes: voteCounts[c.id] || 0
      })).sort((a, b) => b.votes - a.votes);

      const totalVotes = enriched.reduce((s, c) => s + c.votes, 0);

      return { position, candidates: enriched, totalVotes, abstainCount };
    });
  }

  get totalVotesCast(): number {
    return this.voteRecords.filter(r => r.electionId === this.selectedElectionId).length;
  }

  getPercentage(votes: number, totalCast: number): number {
    return totalCast > 0 ? Math.round((votes / totalCast) * 100) : 0;
  }

  isWinner(c: Candidate, group: PositionResult): boolean {
    return group.candidates[0]?.id === c.id && c.votes > 0;
  }
}