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
import { Observable, from, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

// ── Interfaces ───────────────────────────────────────────────
export interface Candidate {
  electionId?: string;
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
  photo?: string | null;
}

export interface Election {
  title?: any;
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  totalPositions: number;
  totalVoters: number;
  voted: number;
  status: 'upcoming' | 'active' | 'completed';
  positions?: string[];
  createdBy?: string;
  createdAt?: string;
  auditStatus?: 'pending' | 'clean' | 'flagged';
  auditNote?: string;
  certifiedAt?: string;
}

export interface Application {
  id: string;
  studentId: string;
  studentName: string;
  name: string;
  course: string;
  year: string;
  age?: number | null;
  position: string;
  party: string;
  bio: string;
  awards: string;
  photo: string;
  photoUrl?: string;
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

export interface AuditLog {
  id?: string;
  action: string;
  performedBy: string;
  details: string;
  targetId?: string;
  createdAt: string;
}

// ── Service ──────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ElectionService {
  private fs = inject(Firestore);

  // ── Helpers ───────────────────────────────────────────────
  private col(name: string) {
    return collection(this.fs, name);
  }
  private ref(name: string, id: string) {
    return doc(this.fs, name, id);
  }

  // ── REAL-TIME list (collectionData) ───────────────────────
  // This is the key — collectionData uses onSnapshot internally
  // so any Firestore change instantly pushes to all subscribers
  private list<T>(name: string): Observable<T[]> {
    return collectionData(this.col(name), { idField: 'id' }) as Observable<T[]>;
  }

  // ── REAL-TIME filtered list ───────────────────────────────
  // Fixed: was using getDocs() (one-time) — now uses collectionData()
  // so filtered results also update in real-time
  private listWhere<T>(name: string, field: string, value: string): Observable<T[]> {
    return collectionData(query(this.col(name), where(field, '==', value)), {
      idField: 'id',
    }) as Observable<T[]>;
  }

  // ── ONE-TIME fetch (still needed for some operations) ─────
  private findWhere<T>(name: string, field: string, value: string): Observable<T[]> {
    return from(
      getDocs(query(this.col(name), where(field, '==', value))).then((s) =>
        s.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
      ),
    );
  }

  private add<T>(name: string, data: any): Observable<T> {
    return from(addDoc(this.col(name), data)).pipe(map((r) => ({ id: r.id, ...data }) as T));
  }

  private update<T>(name: string, item: any): Observable<T> {
    const { id, ...data } = item;
    return from(updateDoc(this.ref(name, id), data)).pipe(map(() => item));
  }

  private remove(name: string, id: string): Observable<any> {
    return from(deleteDoc(this.ref(name, id)));
  }

  // ── Candidates ────────────────────────────────────────────
  // Real-time — any approval instantly updates the ballot
  getCandidates() {
    return this.list<Candidate>('candidates');
  }
  addCandidate(c: Omit<Candidate, 'id'>) {
    return this.add<Candidate>('candidates', c);
  }
  updateCandidate(c: Candidate) {
    return this.update<Candidate>('candidates', c);
  }
  deleteCandidate(id: string) {
    return this.remove('candidates', id);
  }

  // Real-time — ballot updates instantly when candidates are approved
  getCandidatesByElection(electionId: string): Observable<Candidate[]> {
    return this.listWhere<Candidate>('candidates', 'electionId', electionId);
  }

  // ── Voters ────────────────────────────────────────────────
  // Real-time — hasVoted updates instantly across all sessions
  getVoters() {
    return this.list<Voter>('voters');
  }
  addVoter(v: Omit<Voter, 'id'>) {
    return this.add<Voter>('voters', v);
  }
  updateVoter(v: Voter) {
    return this.update<Voter>('voters', v);
  }
  deleteVoter(id: string) {
    return this.remove('voters', id);
  }

  // Real-time — voter status updates instantly
  getVoterByStudentId(studentId: string): Observable<Voter[]> {
    return this.listWhere<Voter>('voters', 'studentId', studentId);
  }

  // ── Elections ─────────────────────────────────────────────
  // Real-time — status changes (active/completed) reflect instantly
  getElections() {
    return this.list<Election>('elections');
  }
  addElection(e: Omit<Election, 'id'>) {
    return this.add<Election>('elections', e);
  }
  updateElection(e: Election) {
    return this.update<Election>('elections', e);
  }
  deleteElection(id: string) {
    return this.remove('elections', id);
  }

  // Real-time — active election updates instantly
  getActiveElection(): Observable<Election[]> {
    return this.listWhere<Election>('elections', 'status', 'active');
  }

  getElectionById(id: string): Observable<Election | null> {
    return from(
      getDoc(this.ref('elections', id)).then((s) =>
        s.exists() ? ({ id: s.id, ...s.data() } as Election) : null,
      ),
    );
  }

  // ── Applications ──────────────────────────────────────────
  // Real-time — new applications appear instantly in admin panel
  getApplications() {
    return this.list<Application>('applications');
  }
  submitApplication(a: Omit<Application, 'id'>) {
    return this.add<Application>('applications', a);
  }
  updateApplication(a: Application) {
    return this.update<Application>('applications', a);
  }

  // Real-time — student sees approval/rejection instantly
  getApplicationByStudentId(id: string): Observable<Application[]> {
    return this.listWhere<Application>('applications', 'studentId', id);
  }

  // ── Vote Records ──────────────────────────────────────────
  // Real-time — vote tally updates instantly
  getVoteRecords() {
    return this.list<VoteRecord>('voteRecords');
  }

  // One-time is fine here — just checking if student already voted
  getVoteRecordByStudentId(id: string): Observable<VoteRecord[]> {
    return this.findWhere<VoteRecord>('voteRecords', 'studentId', id);
  }

  // ── Notifications ─────────────────────────────────────────
  addNotification(n: any): Observable<any> {
    return this.add('notifications', n);
  }

  // Real-time — notifications appear instantly
  getNotifications(role: string): Observable<any[]> {
    return this.listWhere<any>('notifications', 'role', role);
  }

  // ── Audit Logs ────────────────────────────────────────────
  addAuditLog(log: Omit<AuditLog, 'id'>): Observable<AuditLog> {
    return this.add<AuditLog>('auditLogs', log);
  }
  getAuditLogs(): Observable<AuditLog[]> {
    return this.list<AuditLog>('auditLogs');
  }

  // ── Cast Vote ─────────────────────────────────────────────
  castVote(
    voter: Voter,
    election: Election,
    votes: { [position: string]: string },
    candidates: Candidate[],
    allVotes?: { [position: string]: string },
  ): Observable<any> {
    const ABSTAIN = '__ABSTAIN__';

    const record = {
      studentId: voter.studentId,
      electionId: election.id,
      votes: allVotes ?? votes,
      submittedAt: new Date().toISOString(),
    };

    const candidateUpdates = Object.values(votes)
      .filter((cId) => cId && cId !== ABSTAIN)
      .map((cId) => {
        const c = candidates.find((x) => x.id === cId);
        if (!c) throw new Error(`Candidate ${cId} not found`);
        return this.updateCandidate({ ...c, votes: c.votes + 1 });
      });

    return this.add('voteRecords', record).pipe(
      switchMap(() => {
        const updates = [
          ...candidateUpdates,
          this.updateVoter({ ...voter, hasVoted: true, verifiedAt: new Date().toISOString() }),
          this.updateElection({ ...election, voted: election.voted + 1 }),
        ];
        return forkJoin(updates.length > 0 ? updates : [from(Promise.resolve())]);
      }),
    );
  }
}
