import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  setDoc,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Vote {
  private firestore = inject(Firestore);

  async submitVote(vote: any): Promise<void> {
    const ref = doc(collection(this.firestore, 'voteRecords'));
    await setDoc(ref, { ...vote, submittedAt: new Date().toISOString() });
  }

  getVotes(): Observable<any[]> {
    return collectionData(collection(this.firestore, 'voteRecords'), {
      idField: 'id',
    }) as Observable<any[]>;
  }

  async checkVoteStatus(studentId: string, electionId: string): Promise<boolean> {
    const q = query(
      collection(this.firestore, 'voteRecords'),
      where('studentId', '==', studentId),
      where('electionId', '==', electionId),
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }
}
