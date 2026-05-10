import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElectionService } from '../../../services/election';
import { Subscription } from 'rxjs';

export interface ElecomNotification {
  id: string;
  type: 'vote' | 'candidate' | 'election' | 'warning' | 'user' | 'clean' | 'flagged';
  title: string;
  message: string;
  time: string;
  createdAt: string;
  read: boolean;
  seen: boolean;
}

@Component({
  selector: 'app-elecom-notif',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './elecom-notif.html',
  styleUrl: './elecom-notif.scss',
})
export class ElecomNotif implements OnInit, OnDestroy {
  private svc = inject(ElectionService);
  private sub?: Subscription;

  filter: 'all' | 'unread' | 'vote' | 'candidate' | 'election' = 'all';
  notifications: ElecomNotification[] = [];
  loading = true;

  ngOnInit(): void {
    // Pull real notifications from Firestore where role === 'elecom'
    this.sub = this.svc.getNotifications('elecom').subscribe((data: any[]) => {
      this.notifications = data
        .map((n) => ({
          id: n.id,
          type: n.type ?? 'election',
          title: n.title ?? '',
          message: n.message ?? '',
          time: n.createdAt
            ? new Date(n.createdAt).toLocaleString('en-PH', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '',
          createdAt: n.createdAt ?? '',
          read: n.seen ?? false,
          seen: n.seen ?? false,
        }))
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      this.loading = false;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  get filteredNotifs(): ElecomNotification[] {
    if (this.filter === 'unread') return this.notifications.filter((n) => !n.read);
    if (this.filter === 'all') return this.notifications;
    // 'clean' and 'flagged' types belong to the 'election' filter tab
    return this.notifications.filter(
      (n) =>
        n.type === this.filter ||
        (this.filter === 'election' && (n.type === 'clean' || n.type === 'flagged')),
    );
  }

  markRead(n: ElecomNotification): void {
    n.read = true;
    n.seen = true;
  }

  markAllRead(): void {
    this.notifications.forEach((n) => {
      n.read = true;
      n.seen = true;
    });
  }

  /** Maps DB types to one of the five icon buckets */
  iconType(n: ElecomNotification): 'vote' | 'candidate' | 'election' | 'warning' | 'user' {
    if (n.type === 'clean' || n.type === 'flagged') return 'election';
    if (['vote', 'candidate', 'warning', 'user'].includes(n.type)) return n.type as any;
    return 'election';
  }
}