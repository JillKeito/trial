import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentNotification, StudentNotificationService } from '../../../../services/student-notif';

@Component({
  selector: 'app-student-notif',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './student-notif.html',
  styleUrl: './student-notif.scss',
})
export class StudentNotif implements OnInit {
  readonly notifService = inject(StudentNotificationService);

  filter: 'all' | 'unread' | 'election' | 'vote' | 'apply' = 'all';

  ngOnInit(): void {
    this.notifService.loadNotifications();
  }

  get filteredNotifs(): StudentNotification[] {
    const all = this.notifService.notifications();
    if (this.filter === 'unread') return all.filter((n) => !n.read);
    if (this.filter === 'all') return all;
    return all.filter((n) => n.type === this.filter);
  }

  markRead(n: StudentNotification): void {
    this.notifService.markRead(n.id);
  }

  markAllRead(): void {
    this.notifService.markAllRead();
  }
}