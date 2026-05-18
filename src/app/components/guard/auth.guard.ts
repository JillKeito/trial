import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  canActivate(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      if (localStorage.getItem('isLoggedIn') === 'true') {
        return true;
      }
    }
    this.router.navigate(['/login']);
    return false;
  }
}
