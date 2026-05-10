import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, deleteUser } from '@angular/fire/auth';
import { Firestore, doc, runTransaction, collection } from '@angular/fire/firestore';

export interface ElecomUser {
  uid: string;
  email: string;
  name: string;
  username: string;
  role: 'elecom';
  isActive: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ElecomAccount {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  async createElecomAccount(formData: {
    name: string;
    username: string;
    email: string;
    password: string;
  }): Promise<ElecomUser> {
    // ── CONSISTENCY: validate before touching Firebase ────────
    if (!formData.name || !formData.username || !formData.email || !formData.password) {
      throw new Error('All fields are required.');
    }
    if (formData.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    let authUser: any = null;

    try {
      // ── Step 1: Firebase Auth ─────────────────────────────
      // Done outside transaction — Firebase Auth doesn't support
      // transactions. Rolled back manually if Firestore fails.
      const credential = await createUserWithEmailAndPassword(
        this.auth,
        formData.email,
        formData.password,
      );
      authUser = credential.user;
      const uid = credential.user.uid;

      // ── ATOMICITY + ISOLATION: runTransaction ─────────────
      // All Firestore writes succeed together or ALL roll back.
      // Concurrent creates of same username are blocked (Isolation).
      await runTransaction(this.firestore, async (transaction) => {
        // ── READS FIRST (Firestore rule: reads before writes) ─

        // Block duplicate username
        const usernameRef = doc(this.firestore, 'elecomUsernames', formData.username);
        const usernameSnap = await transaction.get(usernameRef);
        if (usernameSnap.exists()) {
          throw new Error('Username is already taken.');
        }

        // ── ALL READS DONE — now writes ───────────────────────

        // 1. Save to /users (same collection as admin — role differentiates)
        const userRef = doc(this.firestore, 'users', uid);
        transaction.set(userRef, {
          uid,
          name: formData.name,
          username: formData.username,
          email: formData.email,
          role: 'elecom',
          isActive: true,
          createdAt: new Date().toISOString(),
        });

        // 2. Reserve username to prevent duplicates
        // Works like a UNIQUE constraint in SQL
        transaction.set(usernameRef, {
          uid,
          createdAt: new Date().toISOString(),
        });

        // ── DURABILITY: once committed, Firestore guarantees ──
        // both documents are permanently stored.
      });

      return {
        uid,
        email: formData.email,
        name: formData.name,
        username: formData.username,
        role: 'elecom',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
    } catch (err: any) {
      // ── ATOMICITY ROLLBACK ────────────────────────────────
      // If Firestore failed AFTER Auth succeeded,
      // delete the Auth account so no orphaned user is left.
      if (authUser) {
        await deleteUser(authUser).catch(() => {});
      }

      if (err.code === 'auth/email-already-in-use') {
        throw new Error('Email is already registered.');
      }
      throw new Error(err.message || 'Failed to create ELECOM account.');
    }
  }
}