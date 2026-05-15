import { Injectable } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ElecomAccount {
  constructor(private firestore: Firestore) {}

  async createElecomAccount(formData: {
    name: string;
    username: string;
    email: string;
    password: string;
  }): Promise<void> {
    if (!formData.name || !formData.email || !formData.password) {
      throw new Error('All fields are required.');
    }
    if (formData.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    // ── Secondary app — keeps admin logged in ─────────────────
    const secondaryAppName = 'elecom-creator';
    const existing = getApps().find((a) => a.name === secondaryAppName);
    const secondaryApp = existing ?? initializeApp(environment.firebase, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    // ── Step 1: Create Firebase Auth account ──────────────────
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      formData.email,
      formData.password,
    );
    const uid = credential.user.uid;

    // Sign out secondary so admin stays logged in
    await secondaryAuth.signOut();

    // ── Step 2: Save to Firestore ─────────────────────────────
    await setDoc(doc(this.firestore, 'users', uid), {
      uid,
      name: formData.name,
      username: formData.username || '',
      email: formData.email,
      role: 'elecom',
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }
}
