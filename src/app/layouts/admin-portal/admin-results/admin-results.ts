import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElectionService, Election, Candidate } from '../../../services/election';

@Component({
  selector: 'admin-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-results.html',
  styleUrls: ['./admin-results.scss'],
})
export class AdminResults implements OnInit {
  completedElections: Election[] = [];
  selectedResultElection: Election | null = null;
  resultsByPosition: { position: string; candidates: Candidate[]; total: number }[] = [];
  loadingResults = false;

  // Distinct colors for pie slices
  private readonly COLORS = [
    '#6366f1',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#3b82f6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
    '#a855f7',
    '#84cc16',
  ];

  constructor(private svc: ElectionService) {}

  ngOnInit() {
    this.svc.getElections().subscribe((elections) => {
      this.completedElections = elections.filter((e) => e.status === 'completed');
    });
  }

  loadResults(election: Election) {
    this.selectedResultElection = election;
    this.loadingResults = true;

    this.svc.getCandidates().subscribe((candidates) => {
      const filtered = candidates.filter(
        (c) => (c as any).electionId === election.id || !c.hasOwnProperty('electionId'),
      );
      const map = new Map<string, Candidate[]>();
      for (const c of filtered) {
        if (!map.has(c.position)) map.set(c.position, []);
        map.get(c.position)!.push(c);
      }
      this.resultsByPosition = Array.from(map.entries()).map(([position, cands]) => {
        const sorted = [...cands].sort((a, b) => b.votes - a.votes);
        return {
          position,
          candidates: sorted,
          total: sorted.reduce((s, c) => s + (c.votes || 0), 0),
        };
      });
      this.loadingResults = false;
    });
  }

  getPercent(votes: number, total: number): number {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  }

  getColor(index: number): string {
    return this.COLORS[index % this.COLORS.length];
  }

  getTotalVotes(): number {
    if (!this.resultsByPosition.length) return 0;
    return Math.max(...this.resultsByPosition.map((g) => g.total));
  }

  getTotalCandidates(): number {
    return this.resultsByPosition.reduce((sum, g) => sum + g.candidates.length, 0);
  }

  // Build SVG pie slices using polar coordinates
  getPieSlices(group: { candidates: Candidate[]; total: number }): { d: string }[] {
    if (group.total === 0) return [];
    const cx = 60,
      cy = 60,
      r = 55;
    let startAngle = -Math.PI / 2; // start at top
    const slices: { d: string }[] = [];

    for (const candidate of group.candidates) {
      const pct = candidate.votes / group.total;
      const angle = pct * 2 * Math.PI;
      const endAngle = startAngle + angle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      // If 100%, draw a full circle
      if (pct >= 1) {
        slices.push({ d: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z` });
      } else {
        slices.push({ d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z` });
      }
      startAngle = endAngle;
    }
    return slices;
  }
}