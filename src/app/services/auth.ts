import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

export type UserRole = 'admin' | 'elecom' | 'student';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  async login(email: string, password: string): Promise<User> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    const uid = credential.user.uid;

    const userDoc = await getDoc(doc(this.firestore, 'users', uid));

    if (!userDoc.exists()) {
      throw new Error('User not found in database');
    }

    const user: User = {
      id: userDoc.id,
      ...(userDoc.data() as Omit<User, 'id'>),
    };

    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('isLoggedIn', 'true');

    return user;
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    this.router.navigate(['/login']);
  }

  getCurrentUser(): User | null {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  }

  isLoggedIn(): boolean {
    return localStorage.getItem('isLoggedIn') === 'true';
  }

  getRole(): UserRole | null {
    return this.getCurrentUser()?.role ?? null;
  }
}
