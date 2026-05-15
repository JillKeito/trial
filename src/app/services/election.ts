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

  // ── REALTIME LIST ─────────────────────────────────────────

  private list<T>(name: string): Observable<T[]> {
    return collectionData(this.col(name), {
      idField: 'id',
    }) as Observable<T[]>;
  }

  // ── REALTIME FILTERED LIST ────────────────────────────────

  private listWhere<T>(name: string, field: string, value: string): Observable<T[]> {
    return collectionData(query(this.col(name), where(field, '==', value)), {
      idField: 'id',
    }) as Observable<T[]>;
  }

  // ── ONE TIME FETCH ────────────────────────────────────────

  private findWhere<T>(name: string, field: string, value: string): Observable<T[]> {
    return from(
      getDocs(query(this.col(name), where(field, '==', value))).then((s) =>
        s.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
            }) as T,
        ),
      ),
    );
  }

  private add<T>(name: string, data: any): Observable<T> {
    return from(addDoc(this.col(name), data)).pipe(
      map(
        (r) =>
          ({
            id: r.id,
            ...data,
          }) as T,
      ),
    );
  }

  private update<T>(name: string, item: any): Observable<T> {
    const { id, ...data } = item;

    return from(updateDoc(this.ref(name, id), data)).pipe(map(() => item));
  }

  private remove(name: string, id: string): Observable<any> {
    return from(deleteDoc(this.ref(name, id)));
  }

  // ──────────────────────────────────────────────────────────
  // Candidates
  // ──────────────────────────────────────────────────────────

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

  // BALLOT REALTIME
  getCandidatesByElection(electionId: string): Observable<Candidate[]> {
    return this.listWhere<Candidate>('candidates', 'electionId', electionId);
  }

  // ──────────────────────────────────────────────────────────
  // Voters
  // ──────────────────────────────────────────────────────────

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

  getVoterByStudentId(studentId: string) {
    return this.listWhere<Voter>('voters', 'studentId', studentId);
  }

  // ──────────────────────────────────────────────────────────
  // Elections
  // ──────────────────────────────────────────────────────────

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

  getActiveElection() {
    return this.listWhere<Election>('elections', 'status', 'active');
  }

  getElectionById(id: string): Observable<Election | null> {
    return from(
      getDoc(this.ref('elections', id)).then((s) =>
        s.exists() ? ({ id: s.id, ...s.data() } as Election) : null,
      ),
    );
  }

  // ──────────────────────────────────────────────────────────
  // Applications
  // ──────────────────────────────────────────────────────────

  getApplications() {
    return this.list<Application>('applications');
  }

  submitApplication(a: Omit<Application, 'id'>) {
    return this.add<Application>('applications', a);
  }

  updateApplication(a: Application) {
    return this.update<Application>('applications', a);
  }

  getApplicationByStudentId(id: string) {
    return this.listWhere<Application>('applications', 'studentId', id);
  }

  // ──────────────────────────────────────────────────────────
  // APPROVE APPLICATION
  // AUTO ADD TO BALLOT
  // ──────────────────────────────────────────────────────────

  approveApplication(app: Application): void {
    // 1. Update application status
    this.updateApplication({
      ...app,
      status: 'approved',
    }).subscribe();

    // 2. Automatically add to candidates collection
    this.addCandidate({
      electionId: app.electionId,

      name: app.name,
      position: app.position,
      party: app.party,

      photo: app.photo,

      bio: app.bio,

      votes: 0,

      course: app.course,
      year: app.year,

      status: 'approved',

      requirements: app.requirements,
    }).subscribe();
  }

  // ──────────────────────────────────────────────────────────
  // Reject Application
  // ──────────────────────────────────────────────────────────

  rejectApplication(app: Application): void {
    this.updateApplication({
      ...app,
      status: 'rejected',
    }).subscribe();
  }

  // ──────────────────────────────────────────────────────────
  // Vote Records
  // ──────────────────────────────────────────────────────────

  getVoteRecords() {
    return this.list<VoteRecord>('voteRecords');
  }

  getVoteRecordByStudentId(id: string) {
    return this.findWhere<VoteRecord>('voteRecords', 'studentId', id);
  }

  // ──────────────────────────────────────────────────────────
  // Notifications
  // ──────────────────────────────────────────────────────────

  addNotification(n: any): Observable<any> {
    return this.add('notifications', n);
  }

  getNotifications(role: string): Observable<any[]> {
    return this.listWhere<any>('notifications', 'role', role);
  }

  // ──────────────────────────────────────────────────────────
  // Audit Logs
  // ──────────────────────────────────────────────────────────

  addAuditLog(log: Omit<AuditLog, 'id'>) {
    return this.add<AuditLog>('auditLogs', log);
  }

  getAuditLogs() {
    return this.list<AuditLog>('auditLogs');
  }

  // ──────────────────────────────────────────────────────────
  // Cast Vote
  // ──────────────────────────────────────────────────────────

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

        if (!c) {
          throw new Error(`Candidate ${cId} not found`);
        }

        return this.updateCandidate({
          ...c,
          votes: c.votes + 1,
        });
      });

    return this.add('voteRecords', record).pipe(
      switchMap(() => {
        const updates = [
          ...candidateUpdates,

          this.updateVoter({
            ...voter,
            hasVoted: true,
            verifiedAt: new Date().toISOString(),
          }),

          this.updateElection({
            ...election,
            voted: election.voted + 1,
          }),
        ];

        return forkJoin(updates.length > 0 ? updates : [from(Promise.resolve())]);
      }),
    );
  }
}
