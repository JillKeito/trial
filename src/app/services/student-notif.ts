import { Injectable, inject, signal, computed } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from './auth';

export interface StudentNotification {
  id: string;
  type: 'election' | 'vote' | 'candidate' | 'announcement' | 'apply';
  title: string;
  message: string;
  time: string;
  createdAt: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class StudentNotificationService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);

  private _notifications = signal<StudentNotification[]>([]);

  readonly notifications = this._notifications.asReadonly();

  readonly unreadCount = computed(
    () => this._notifications().filter((n) => !n.read).length
  );

  /**
   * TODO: Replace body with a Firestore real-time listener:
   *
   * const uid = this.auth.getCurrentUser()?.id;
   * const ref = collection(this.firestore, 'users', uid, 'notifications');
   * onSnapshot(query(ref, orderBy('createdAt', 'desc')), (snap) => {
   *   this._notifications.set(
   *     snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentNotification))
   *   );
   * });
   */
  loadNotifications(): void {
    // Firestore logic goes here
  }

  /**
   * TODO: Update Firestore document:
   *
   * const uid = this.auth.getCurrentUser()?.id;
   * await updateDoc(
   *   doc(this.firestore, 'users', uid, 'notifications', id),
   *   { read: true }
   * );
   */
  async markRead(id: string): Promise<void> {
    // Firestore logic goes here

    // Optimistic local update:
    this._notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  /**
   * TODO: Batch-update all unread docs:
   *
   * const uid = this.auth.getCurrentUser()?.id;
   * const batch = writeBatch(this.firestore);
   * this._notifications()
   *   .filter(n => !n.read)
   *   .forEach(n =>
   *     batch.update(
   *       doc(this.firestore, 'users', uid, 'notifications', n.id),
   *       { read: true }
   *     )
   *   );
   * await batch.commit();
   */
  async markAllRead(): Promise<void> {
    // Firestore logic goes here

    // Optimistic local update:
    this._notifications.update((list) => list.map((n) => ({ ...n, read: true })));
  }
}