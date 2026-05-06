import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  host: { style: 'display: block; width: 100%; height: 100vh;' },
})
export class LoginComponent implements OnInit {
  identifier = '';
  password = '';
  error: string | null = null;
  loading = false;

  private platformId = inject(PLATFORM_ID);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (localStorage.getItem('isLoggedIn') === 'true') {
        const role = this.auth.getRole();
        if (role === 'admin') this.router.navigate(['/app/admin-dashboard']);
        else if (role === 'elecom') this.router.navigate(['/app/elecom-dashboard']);
        else if (role === 'student') this.router.navigate(['/app/student-dashboard']);
      }
    }
  }

  async login() {
    this.error = null;

    if (!this.identifier || !this.password) {
      this.error = 'Please enter identifier and password';
      return;
    }

    this.loading = true;

    try {
      const user = await this.auth.login(this.identifier, this.password);

      const roleLabel =
        user.role === 'admin'
          ? 'Administrator'
          : user.role === 'elecom'
            ? 'Electoral Commission'
            : user.role === 'student'
              ? 'Student'
              : 'Unknown';

      await Swal.fire({
        icon: 'success',
        title: 'Login Successful!',
        text: `Welcome, ${roleLabel}!`,
        timer: 1500,
        showConfirmButton: false,
      });

      if (user.role === 'admin') this.router.navigate(['/app/admin-dashboard']);
      else if (user.role === 'elecom') this.router.navigate(['/app/elecom-dashboard']);
      else if (user.role === 'student') this.router.navigate(['/app/student-dashboard']);
    } catch (err) {
      this.error = 'Invalid email or password';
    } finally {
      this.loading = false;
    }
  }
}
