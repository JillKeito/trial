import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterModule, RouterOutlet } from '@angular/router';
import { AuthService, User } from '../../services/auth';

import Swal from 'sweetalert2';
import { StudentNotificationService } from '../../services/student-notif';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss'],
  host: { style: 'display: block; width: 100%; height: 100vh;' },
})
export class MainLayout implements OnInit {
  sidebarOpen = false;
  isProfileMenuOpen = false;
  unseenCount = 0;
  currentUser: User | null = null;

  private platformId = inject(PLATFORM_ID);
  readonly studentNotifService = inject(StudentNotificationService);
  studentNotif: any;

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadUser();
    this.router.events.subscribe(() => {
      this.loadUser();
      this.isProfileMenuOpen = false;
      this.sidebarOpen = false;
    });

    if (this.isStudent()) {
      this.studentNotif = new StudentNotificationService();
      this.studentNotif.loadNotifications();
    }
  }

  loadUser(): void {
    this.currentUser = this.auth.getCurrentUser();
  }

  isElecom(): boolean {
    return this.currentUser?.role === 'elecom';
  }

  isStudent(): boolean {
    return this.currentUser?.role === 'student';
  }

  getUserName(): string {
    return this.currentUser?.name || 'User';
  }

  getUserInitial(): string {
    return this.currentUser?.name?.charAt(0)?.toUpperCase() || 'U';
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  goToNotifications(): void {
    if (this.isElecom()) {
      this.router.navigate(['/app/elecom-notifications']);
    }
    if (this.isStudent()) {
      this.router.navigate(['/app/student-notifications']);
    }
  }

  goToSettings(event: Event): void {
    event.stopPropagation();
    this.isProfileMenuOpen = false;
    const role = this.auth.getRole();
    if (role === 'admin') {
      this.router.navigate(['/app/admin-settings']);
    } else if (role === 'elecom') {
      this.router.navigate(['/app/elecom-settings']);
    }
  }

  goToElecomSetting(event: Event): void {
    this.goToSettings(event);
  }

  logout(): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will be logged out of your session!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#7B1C2E',
      cancelButtonColor: '#c0392b',
      confirmButtonText: 'Yes, logout!',
      cancelButtonText: 'Cancel',
    }).then(async (result) => {
      if (result.isConfirmed) {
        await this.auth.logout();
        Swal.fire({
          title: 'Logged out!',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        });
      }
    });
  }
}