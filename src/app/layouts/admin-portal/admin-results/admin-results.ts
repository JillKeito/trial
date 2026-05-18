import { Component, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElectionService, Election, Candidate } from '../../../services/election';
import { Chart, ArcElement, DoughnutController, Tooltip, Legend } from 'chart.js';

Chart.register(ArcElement, DoughnutController, Tooltip, Legend);

@Component({
  selector: 'admin-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-results.html',
  styleUrls: ['./admin-results.scss'],
})
export class AdminResults implements OnInit, OnDestroy, AfterViewChecked {
  completedElections: Election[] = [];
  selectedResultElection: Election | null = null;
  resultsByPosition: { position: string; candidates: Candidate[]; total: number }[] = [];
  loadingResults = false;

  private charts: Map<string, Chart> = new Map();
  private chartsNeedRender = false;

  readonly COLORS = [
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

  ngOnDestroy(): void {
    this.destroyAllCharts();
  }

  ngAfterViewChecked(): void {
    if (this.chartsNeedRender && this.resultsByPosition.length > 0) {
      this.chartsNeedRender = false;
      setTimeout(() => this.renderCharts(), 50);
    }
  }

  loadResults(election: Election) {
    this.selectedResultElection = election;
    this.loadingResults = true;
    this.destroyAllCharts();
    this.resultsByPosition = [];

    // ── Flaw 3 fix: strict electionId filter ──
    this.svc.getCandidates().subscribe((candidates) => {
      const filtered = candidates.filter((c) => (c as any).electionId === election.id);

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
      this.chartsNeedRender = true;
    });
  }

  renderCharts(): void {
    this.resultsByPosition.forEach((group, i) => {
      const canvasId = `pie-result-${i}`;
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;

      const existing = this.charts.get(canvasId);
      if (existing) {
        existing.destroy();
        this.charts.delete(canvasId);
      }

      const labels = group.candidates.map((c) => c.name);
      const data = group.candidates.map((c) => c.votes || 0);
      const colors = group.candidates.map((_, j) => this.COLORS[j % this.COLORS.length]);
      const hasVotes = data.some((v) => v > 0);

      const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: hasVotes ? data : group.candidates.map(() => 1),
              backgroundColor: hasVotes ? colors : colors.map((c) => c + '55'),
              borderColor: '#ffffff',
              borderWidth: 3,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: false,
          cutout: '62%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  if (!hasVotes) return ' No votes yet';
                  const val = ctx.parsed as number;
                  const pct = group.total > 0 ? Math.round((val / group.total) * 100) : 0;
                  return ` ${val} votes (${pct}%)`;
                },
              },
            },
          },
        },
      });

      this.charts.set(canvasId, chart);
    });
  }

  destroyAllCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts.clear();
  }

  back(): void {
    this.selectedResultElection = null;
    this.resultsByPosition = [];
    this.destroyAllCharts();
  }

  getPercent(votes: number, total: number): number {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  }

  getColor(index: number): string {
    return this.COLORS[index % this.COLORS.length];
  }

  getWinner(group: { candidates: Candidate[]; total: number }): Candidate {
    return group.candidates[0] ?? ({ name: '—', votes: 0 } as any);
  }

  getTotalVotes(): number {
    if (!this.resultsByPosition.length) return 0;
    return Math.max(...this.resultsByPosition.map((g) => g.total));
  }

  getTotalCandidates(): number {
    return this.resultsByPosition.reduce((sum, g) => sum + g.candidates.length, 0);
  }
}
