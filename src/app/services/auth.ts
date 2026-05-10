import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
} from '@angular/fire/firestore';

export type UserRole = 'admin' | 'elecom' | 'student';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  createdAt?: string;
}

// The fake-email domain used for voter Firebase Auth accounts
const VOTER_EMAIL_DOMAIN = 'evoting.voter.com';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  // ── Login ─────────────────────────────────────────────────────
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

  // ── Register Voter ────────────────────────────────────────────
  //
  // Called from the Elecom Voters page when adding a new voter.
  //
  // What it does:
  //   1. Converts studentId to a fake email: 2024-0001 -> 2024-0001@evoting.voter.com
  //   2. Creates a Firebase Auth account with that email + the provided password
  //   3. Writes the user record to Firestore users/{uid} with role: 'student'
  //   4. Writes the voter record to Firestore voters/ collection
  //
  async registerVoter(data: {
    studentId: string;
    name: string;
    course: string;
    year: string;
    password: string;
  }): Promise<void> {
    const { studentId, name, course, year, password } = data;

    // 1. Build fake email from student ID
    const fakeEmail = `${studentId.trim()}@${VOTER_EMAIL_DOMAIN}`;

    // 2. Create Firebase Auth account
    const credential = await createUserWithEmailAndPassword(
      this.auth,
      fakeEmail,
      password,
    );
    const uid = credential.user.uid;

    // 3. Write to users/{uid} so the shared login flow can look them up
    await setDoc(doc(this.firestore, 'users', uid), {
      email: fakeEmail,
      role: 'student' as UserRole,
      name,
      studentId,
      createdAt: new Date().toISOString(),
    });

    // 4. Write to voters/ collection (used by the Voters page listing)
    await addDoc(collection(this.firestore, 'voters'), {
      studentId,
      name,
      course,
      year,
      hasVoted: false,
      verifiedAt: null,
      uid,
      createdAt: new Date().toISOString(),
    });
  }

  // ── Helper: build fake email from student ID ──────────────────
  // Used by the login component so students can log in with just
  // their Student ID — the component converts it before calling login().
  static buildVoterEmail(studentId: string): string {
    return `${studentId.trim()}@${VOTER_EMAIL_DOMAIN}`;
  }

  // ── Logout ────────────────────────────────────────────────────
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