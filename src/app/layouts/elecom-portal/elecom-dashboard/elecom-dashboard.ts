import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ElectionService, Election } from '../../../services/election';
import { FormsModule } from '@angular/forms';

export interface Activity {
  type: 'user' | 'vote' | 'election' | 'candidate' | 'warning';
  title: string;
  subtitle: string;
  time: string;
}

@Component({
  selector: 'app-elecom-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './elecom-dashboard.html',
  styleUrl: './elecom-dashboard.scss',
})
export class ElecomDashboard implements OnInit, OnDestroy {
  stats = {
    totalVoters: 0,
    voted: 0,
    notVoted: 0,
    totalCandidates: 0,
    approvedCandidates: 0,
    pendingCandidates: 0,
  };

  activeElection: Election | null = null;
  upcomingElection: Election | null = null;
  showConfirmModal = false;
  confirmAction: 'start' | 'end' | null = null;

  newElection = { name: '', description: '', startDate: '', endDate: '' };

  recentActivities: Activity[] = [
    {
      type: 'vote',
      title: 'New vote cast',
      subtitle: 'Anonymous voter — ballot submitted',
      time: '11:30 AM',
    },
    {
      type: 'candidate',
      title: 'Candidate approved',
      subtitle: 'Maria Santos — President',
      time: '10:45 AM',
    },
    {
      type: 'user',
      title: 'Voter verified',
      subtitle: 'Student ID 2023-0005 cleared',
      time: '10:02 AM',
    },
    {
      type: 'election',
      title: 'Election configured',
      subtitle: '7 positions set up by ELECOM',
      time: '08:00 AM',
    },
  ];

  constructor(
    private svc: ElectionService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }
  ngOnDestroy(): void {}

  loadStats(): void {
    this.svc.getVoters().subscribe((voters) => {
      this.stats.totalVoters = voters.length;
      this.stats.voted = voters.filter((v) => v.hasVoted).length;
      this.stats.notVoted = this.stats.totalVoters - this.stats.voted;
    });

    this.svc.getCandidates().subscribe((candidates) => {
      this.stats.totalCandidates = candidates.length;
      this.stats.approvedCandidates = candidates.filter((c) => c.status === 'approved').length;
      this.stats.pendingCandidates = candidates.filter((c) => c.status === 'pending').length;
    });

    this.svc.getElections().subscribe((elections) => {
      this.activeElection = elections.find((e) => e.status === 'active') || null;
      this.upcomingElection = elections.find((e) => e.status === 'upcoming') || null;
    });
  }

  createElection(): void {
    if (!this.newElection.name || !this.newElection.startDate || !this.newElection.endDate) return;

    // ✅ removed markAllRead, markNotificationRead, getNotifications
    const payload: Omit<Election, 'id'> = {
      name: this.newElection.name,
      description: this.newElection.description,
      startDate: this.newElection.startDate,
      endDate: this.newElection.endDate,
      totalPositions: 7,
      totalVoters: 0,
      voted: 0,
      status: 'upcoming',
    };

    this.svc.addElection(payload).subscribe(() => {
      this.addActivity('election', 'Election created', payload.name, this.nowStr());
      this.newElection = { name: '', description: '', startDate: '', endDate: '' };
      this.loadStats();
    });
  }

  promptStart(): void {
    if (!this.upcomingElection) return;
    this.confirmAction = 'start';
    this.showConfirmModal = true;
  }

  promptEnd(): void {
    if (!this.activeElection) return;
    this.confirmAction = 'end';
    this.showConfirmModal = true;
  }

  confirmElectionAction(): void {
    if (this.confirmAction === 'start' && this.upcomingElection) {
      const updated: Election = { ...this.upcomingElection, status: 'active' };
      this.svc.updateElection(updated).subscribe(() => {
        this.addActivity('election', 'Election started', updated.name, this.nowStr());
        this.loadStats();
      });
    }
    if (this.confirmAction === 'end' && this.activeElection) {
      const updated: Election = { ...this.activeElection, status: 'completed' };
      this.svc.updateElection(updated).subscribe(() => {
        this.addActivity('election', 'Election ended', updated.name, this.nowStr());
        this.loadStats();
      });
    }
    this.showConfirmModal = false;
    this.confirmAction = null;
  }

  get participationRate(): number {
    return this.stats.totalVoters > 0
      ? Math.round((this.stats.voted / this.stats.totalVoters) * 100)
      : 0;
  }

  get statusLabel(): string {
    if (this.activeElection) return 'Active';
    if (this.upcomingElection) return 'Ready to Start';
    return 'No Election';
  }

  get statusClass(): string {
    if (this.activeElection) return 'status-active';
    if (this.upcomingElection) return 'status-pending';
    return 'status-ended';
  }

  addActivity(type: Activity['type'], title: string, subtitle: string, time: string): void {
    this.recentActivities.unshift({ type, title, subtitle, time });
    if (this.recentActivities.length > 10) this.recentActivities.pop();
  }

  nowStr(): string {
    return new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }

  goTo(path: string): void {
    this.router.navigate([path]);
  }
}
