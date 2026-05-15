import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElectionService } from '../../../services/election';

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-audit.html',
  styleUrls: ['./admin-audit.scss'],
})
export class AdminAudit implements OnInit {
  logs: any[] = [];
  loading = true;

  constructor(private svc: ElectionService) {}

  ngOnInit() {
    this.svc.getAuditLogs().subscribe((logs) => {
      this.logs = logs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      this.loading = false;
    });
  }

  actionClass(action: string): string {
    if (action.includes('DELETED') || action.includes('FLAGGED')) return 'badge-danger';
    if (
      action.includes('CREATED') ||
      action.includes('APPROVED') ||
      action.includes('CERTIFIED') ||
      action.includes('REGISTERED')
    )
      return 'badge-success';
    if (action.includes('STARTED')) return 'badge-active';
    if (action.includes('ENDED')) return 'badge-completed';
    if (action.includes('DISQUALIFIED')) return 'badge-warning';
    return 'badge-default';
  }

  actionIcon(action: string): string {
    if (action.includes('DELETED')) return '🗑️';
    if (action.includes('CREATED') || action.includes('REGISTERED')) return '➕';
    if (action.includes('APPROVED') || action.includes('CERTIFIED')) return '✅';
    if (action.includes('STARTED')) return '▶️';
    if (action.includes('ENDED')) return '⏹️';
    if (action.includes('FLAGGED')) return '⚠️';
    if (action.includes('DISQUALIFIED')) return '❌';
    if (action.includes('UPDATED')) return '✏️';
    if (action.includes('ELECOM')) return '👤';
    return '📋';
  }
}
