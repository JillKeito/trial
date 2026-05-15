import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ElectionService } from '../../../services/election';

@Component({
  selector: 'admin-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-notifications.html',
  styleUrls: ['./admin-notifications.scss'],
})
export class AdminNotifications implements OnInit {
  activeTab = 'all';
  loading = true;

  // ── Two types of real notifications ──────────────────────────
  // 1. From students applying as candidates (role: 'admin-candidate')
  // 2. From ELECOM audit results (role: 'elecom')
  candidateNotifs: any[] = [];
  elecomNotifs: any[] = [];

  tabs = [
    { key: 'all', label: 'All', count: 0 },
    { key: 'unread', label: 'Unread', count: 0 },
    { key: 'candidates', label: 'Candidates', count: 0 },
    { key: 'elecom', label: 'ELECOM', count: 0 },
  ];

  constructor(private svc: ElectionService) {}

  ngOnInit(): void {
    // ── Load candidate application notifications ──────────────
    // Fired when a student submits an application (student-apply.ts)
    this.svc.getNotifications('admin-candidate').subscribe((notifs: any[]) => {
      this.candidateNotifs = notifs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      this.loading = false;
      this.refreshTabCounts();
    });

    // ── Load ELECOM audit notifications ───────────────────────
    // Fired when admin certifies or flags an election
    this.svc.getNotifications('elecom').subscribe((notifs: any[]) => {
      this.elecomNotifs = notifs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      this.refreshTabCounts();
    });
  }

  // ── All notifications combined ────────────────────────────────
  get allNotifications(): any[] {
    return [...this.candidateNotifs, ...this.elecomNotifs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // ── Filtered list based on active tab ────────────────────────
  get filteredNotifications(): any[] {
    switch (this.activeTab) {
      case 'unread':
        return this.allNotifications.filter((n) => !n.seen);
      case 'candidates':
        return this.candidateNotifs;
      case 'elecom':
        return this.elecomNotifs;
      default:
        return this.allNotifications;
    }
  }

  get unreadCount(): number {
    return this.allNotifications.filter((n) => !n.seen).length;
  }

  get unreadCandidateCount(): number {
    return this.candidateNotifs.filter((n) => !n.seen).length;
  }

  get unreadElecomCount(): number {
    return this.elecomNotifs.filter((n) => !n.seen).length;
  }

  // ── Get notification category icon ────────────────────────────
  getCategory(notif: any): string {
    if (notif.type === 'new-application') return 'candidates';
    if (notif.type === 'clean') return 'results';
    if (notif.type === 'flagged') return 'results';
    return 'system';
  }

  // ── Time ago helper ───────────────────────────────────────────
  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  }

  setActiveTab(key: string): void {
    this.activeTab = key;
  }

  markAsRead(notif: any): void {
    notif.seen = true;
    this.refreshTabCounts();
  }

  markAllAsRead(): void {
    this.allNotifications.forEach((n) => (n.seen = true));
    this.refreshTabCounts();
  }

  private refreshTabCounts(): void {
    this.tabs.find((t) => t.key === 'unread')!.count = this.unreadCount;
    this.tabs.find((t) => t.key === 'candidates')!.count = this.unreadCandidateCount;
    this.tabs.find((t) => t.key === 'elecom')!.count = this.unreadElecomCount;
  }
}
