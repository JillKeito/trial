import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';

export interface Candidate {
  id: string;
  name: string;
  position: string;
  party: string;
  photo: string;
  votes: number;
  bio: string;
  course?: string;
  year?: string;
  status?: 'pending' | 'approved' | 'disqualified';
  requirements?: {
    enrollment: boolean;
    goodMoral: boolean;
    residency: boolean;
    coc: boolean;
    noViolations: boolean;
    noFailingGrades: boolean;
  };
}

export interface Voter {
  id: string;
  studentId: string;
  name: string;
  course: string;
  year: string;
  hasVoted: boolean;
  verifiedAt: string | null;
}

export interface Election {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  totalPositions: number;
  totalVoters: number;
  voted: number;
  status: 'upcoming' | 'active' | 'completed';
}

export interface Application {
  id: string;
  studentId: string;
  studentName: string;
  name: string;
  course: string;
  year: string;
  position: string;
  party: string;
  bio: string;
  awards: string;
  photo: string;
  supportingDoc: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  electionId: string;
  requirements?: {
    enrollment: boolean;
    goodMoral: boolean;
    residency: boolean;
    coc: boolean;
    noViolations: boolean;
    noFailingGrades: boolean;
  };
}

export interface VoteRecord {
  id: string;
  studentId: string;
  electionId: string;
  votes: { [position: string]: string };
  submittedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ElectionService {
  private firestore = inject(Firestore);

  // ── CANDIDATES ───────────────────────────────────────────────
  getCandidates(): Observable<Candidate[]> {
    return collectionData(collection(this.firestore, 'candidates'), {
      idField: 'id',
    }) as Observable<Candidate[]>;
  }

  addCandidate(c: Omit<Candidate, 'id'>): Observable<any> {
    return from(addDoc(collection(this.firestore, 'candidates'), c));
  }

  updateCandidate(c: Candidate): Observable<any> {
    const { id, ...data } = c;
    return from(updateDoc(doc(this.firestore, 'candidates', id), data));
  }

  deleteCandidate(id: string): Observable<any> {
    return from(deleteDoc(doc(this.firestore, 'candidates', id)));
  }

  getCandidatesByElection(electionId: string): Observable<Candidate[]> {
    const q = query(
      collection(this.firestore, 'candidates'),
      where('electionId', '==', electionId),
    );
    return from(
      getDocs(q).then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Candidate)),
    );
  }

  // ── VOTERS ───────────────────────────────────────────────────
  getVoters(): Observable<Voter[]> {
    return collectionData(collection(this.firestore, 'voters'), { idField: 'id' }) as Observable<
      Voter[]
    >;
  }

  getVoterByStudentId(studentId: string): Observable<Voter[]> {
    const q = query(collection(this.firestore, 'voters'), where('studentId', '==', studentId));
    return from(
      getDocs(q).then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Voter)),
    );
  }

  addVoter(v: Omit<Voter, 'id'>): Observable<any> {
    return from(addDoc(collection(this.firestore, 'voters'), v));
  }

  updateVoter(v: Voter): Observable<any> {
    const { id, ...data } = v;
    return from(updateDoc(doc(this.firestore, 'voters', id), data));
  }

  deleteVoter(id: string): Observable<any> {
    return from(deleteDoc(doc(this.firestore, 'voters', id)));
  }

  // ── ELECTIONS ────────────────────────────────────────────────
  getElections(): Observable<Election[]> {
    return collectionData(collection(this.firestore, 'elections'), { idField: 'id' }) as Observable<
      Election[]
    >;
  }

  getActiveElection(): Observable<Election[]> {
    const q = query(collection(this.firestore, 'elections'), where('status', '==', 'active'));
    return from(
      getDocs(q).then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Election)),
    );
  }

  getElectionById(id: string): Observable<Election | null> {
    return from(
      getDoc(doc(this.firestore, 'elections', id)).then((snap) => {
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Election;
      }),
    );
  }

  addElection(e: Omit<Election, 'id'>): Observable<any> {
    return from(addDoc(collection(this.firestore, 'elections'), e));
  }

  updateElection(e: Election): Observable<any> {
    const { id, ...data } = e;
    return from(updateDoc(doc(this.firestore, 'elections', id), data));
  }

  deleteElection(id: string): Observable<any> {
    return from(deleteDoc(doc(this.firestore, 'elections', id)));
  }

  // ── APPLICATIONS ─────────────────────────────────────────────
  getApplications(): Observable<Application[]> {
    return collectionData(collection(this.firestore, 'applications'), {
      idField: 'id',
    }) as Observable<Application[]>;
  }

  getApplicationByStudentId(studentId: string): Observable<Application[]> {
    const q = query(
      collection(this.firestore, 'applications'),
      where('studentId', '==', studentId),
    );
    return from(
      getDocs(q).then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Application)),
    );
  }

  submitApplication(a: Omit<Application, 'id'>): Observable<any> {
    return from(addDoc(collection(this.firestore, 'applications'), a));
  }

  updateApplication(a: Application): Observable<any> {
    const { id, ...data } = a;
    return from(updateDoc(doc(this.firestore, 'applications', id), data));
  }

  // ── VOTE RECORDS ─────────────────────────────────────────────
  getVoteRecords(): Observable<VoteRecord[]> {
    return collectionData(collection(this.firestore, 'voteRecords'), {
      idField: 'id',
    }) as Observable<VoteRecord[]>;
  }

  getVoteRecordByStudentId(studentId: string): Observable<VoteRecord[]> {
    const q = query(collection(this.firestore, 'voteRecords'), where('studentId', '==', studentId));
    return from(
      getDocs(q).then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VoteRecord)),
    );
  }

  // ── CAST VOTE ────────────────────────────────────────────────
  castVote(
    voter: Voter,
    election: Election,
    votes: { [position: string]: string },
    candidates: Candidate[],
  ): Observable<any> {
    const record: Omit<VoteRecord, 'id'> = {
      studentId: voter.studentId,
      electionId: election.id,
      votes,
      submittedAt: new Date().toISOString(),
    };

    const candidateUpdates = Object.values(votes).map((candidateId) => {
      const candidate = candidates.find((c) => c.id === candidateId);
      if (!candidate) throw new Error(`Candidate ${candidateId} not found`);
      return updateDoc(doc(this.firestore, 'candidates', candidateId), {
        votes: candidate.votes + 1,
      });
    });

    return from(
      addDoc(collection(this.firestore, 'voteRecords'), record).then(() =>
        Promise.all([
          ...candidateUpdates,
          updateDoc(doc(this.firestore, 'voters', voter.id), {
            hasVoted: true,
            verifiedAt: new Date().toISOString(),
          }),
          updateDoc(doc(this.firestore, 'elections', election.id), {
            voted: election.voted + 1,
          }),
        ]),
      ),
    );
  }
}
