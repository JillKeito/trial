import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Users {
  private firestore = inject(Firestore);

  getUsers(): Observable<any[]> {
    return collectionData(collection(this.firestore, 'users'), { idField: 'id' }) as Observable<
      any[]
    >;
  }

  async addUser(user: any): Promise<void> {
    const ref = doc(collection(this.firestore, 'users'));
    await setDoc(ref, user);
  }

  async updateUser(id: string, user: any): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', id), user);
  }

  async deleteUser(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'users', id));
  }
}
