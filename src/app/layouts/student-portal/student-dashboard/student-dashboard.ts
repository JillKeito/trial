import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { ElectionService, Election, Voter, Application, Candidate } from '../../../services/election';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-dashboard.html',
  styleUrl: './student-dashboard.scss',
})
export class StudentDashboard implements OnInit, OnDestroy {
  elections: Election[] = [];
  voter: Voter | null = null;
  application: Application | null = null;
  candidates: Candidate[] = [];
  activeElection: Election | null = null;
  loading = true;

  // which section is expanded on dashboard
  activeTab: 'overview' | 'candidates' | 'results' = 'overview';

  // position filter for candidates tab
  selectedPosition = 'all';

  private refreshInterval: any;

  constructor(
    public auth: AuthService,
    private svc: ElectionService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    if (!user) { this.loading = false; return; }

    this.svc.getElections().subscribe((elections) => {
      this.elections = elections;
      this.activeElection = elections.find(e => e.status === 'active') || null;
    });

    this.svc.getVoterByStudentId(user.email).subscribe((voters: Voter[]) => {
      this.voter = voters[0] || null;
    });

    this.svc.getApplicationByStudentId(user.email).subscribe((apps: Application[]) => {
      this.application = apps[0] || null;
      this.loading = false;
    });

    this.svc.getCandidates().subscribe((all) => {
      this.candidates = all.filter(c => c.status === 'approved');
    });

    // auto-refresh results every 15 seconds
    this.refreshInterval = setInterval(() => this.refreshResults(), 15000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  refreshResults(): void {
    this.svc.getCandidates().subscribe((all) => {
      this.candidates = all.filter(c => c.status === 'approved');
    });
    this.svc.getElections().subscribe((elections) => {
      this.activeElection = elections.find(e => e.status === 'active') || null;
    });
  }

  // ── Getters ─────────────────────────────────────────────────

  get activeElections(): Election[] {
    return this.elections.filter(e => e.status === 'active');
  }

  get upcomingElections(): Election[] {
    return this.elections.filter(e => e.status === 'upcoming');
  }

  get isRegistered(): boolean { return !!this.voter; }
  get hasVoted(): boolean { return this.voter?.hasVoted ?? false; }

  get totalVotes(): number {
    return this.candidates.reduce((s, c) => s + (c.votes || 0), 0);
  }

  get turnoutPercent(): number {
    if (!this.activeElection || !this.activeElection.totalVoters) return 0;
    return Math.round((this.activeElection.voted / this.activeElection.totalVoters) * 100);
  }

  // ── Candidates (for Candidates tab) ─────────────────────────

  get allPositions(): string[] {
    return [...new Set(this.candidates.map(c => c.position))];
  }

  get filteredCandidates(): Candidate[] {
    if (this.selectedPosition === 'all') return this.candidates;
    return this.candidates.filter(c => c.position === this.selectedPosition);
  }

  // ── Results (for Results tab) ────────────────────────────────

  get resultsByPosition(): { position: string; candidates: Candidate[]; totalVotes: number }[] {
    const map = new Map<string, Candidate[]>();
    for (const c of this.candidates) {
      if (!map.has(c.position)) map.set(c.position, []);
      map.get(c.position)!.push(c);
    }
    return Array.from(map.entries()).map(([position, cands]) => {
      const sorted = [...cands].sort((a, b) => b.votes - a.votes);
      return { position, candidates: sorted, totalVotes: sorted.reduce((s, c) => s + c.votes, 0) };
    });
  }

  getPercentage(votes: number, total: number): number {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  }

  isWinner(c: Candidate, group: { candidates: Candidate[] }): boolean {
    return group.candidates[0]?.id === c.id && c.votes > 0;
  }

  getInitial(name: string): string {
    return name?.charAt(0)?.toUpperCase() || '?';
  }

  // ── Navigation ───────────────────────────────────────────────

  goToVote(election: Election): void { this.router.navigate(['/app/student-ballot']); }
  goToElections(): void { this.router.navigate(['/app/student-elections']); }
  goToApply(): void { this.router.navigate(['/app/student-apply']); }
}