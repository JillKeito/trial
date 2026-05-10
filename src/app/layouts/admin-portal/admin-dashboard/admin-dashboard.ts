import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Election, Application, Candidate } from '../../../services/election';
import { AuthService } from '../../../services/auth';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { inject } from '@angular/core';

export interface AuditCheck {
  label: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

@Component({
  selector: 'admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss'],
})
export class AdminDashboard implements OnInit {
  // ── Firebase ─────────────────────────────────────────────────
  private firebaseAuth = inject(Auth);
  private firestore = inject(Firestore);

  // ── Elections ─────────────────────────────────────────────────
  elections: Election[] = [];
  loading = false;

  // ── Tabs ──────────────────────────────────────────────────────
  activeTab: 'elections' | 'applications' | 'results' | 'accounts' = 'elections';

  // ── Applications ──────────────────────────────────────────────
  applications: Application[] = [];
  loadingApps = false;

  // ── Results ───────────────────────────────────────────────────
  resultsByPosition: { position: string; candidates: Candidate[]; total: number }[] = [];
  loadingResults = false;
  selectedResultElection: Election | null = null;

  // ── Create ELECOM account modal ───────────────────────────────
  showAccountModal = false;
  accountForm = { name: '', email: '', password: '' };
  creatingAccount = false;

  // ── Create/Edit election modal ────────────────────────────────
  showModal = false;
  isEditMode = false;
  selectedElection: Partial<Election> = {};
  form = { name: '', description: '', startDate: '', endDate: '', totalPositions: 7 };

  // ── Audit modal ───────────────────────────────────────────────
  showAuditModal = false;
  auditElection: Election | null = null;
  auditChecks: AuditCheck[] = [];
  auditLoading = false;
  auditNote = '';

  constructor(
    private svc: ElectionService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.loadElections();
    this.loadApplications();
  }

  // ── Load elections ────────────────────────────────────────────
  loadElections() {
    this.loading = true;
    this.svc.getElections().subscribe((e) => {
      this.elections = e;
      this.loading = false;
    });
  }

  // ── Load candidate applications ───────────────────────────────
  loadApplications() {
    this.loadingApps = true;
    this.svc.getApplications().subscribe((apps) => {
      this.applications = apps;
      this.loadingApps = false;
    });
  }

  // ── Approve application ───────────────────────────────────────
  approveApplication(app: Application) {
    Swal.fire({
      title: 'Approve candidate?',
      text: `${app.name} for ${app.position}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      confirmButtonText: 'Approve',
    }).then((r) => {
      if (!r.isConfirmed) return;

      this.svc.updateApplication({ ...app, status: 'approved' }).subscribe(() => {
        this.svc
          .addCandidate({
            name: app.name,
            position: app.position,
            party: app.party,
            photo: app.photo || '',
            votes: 0,
            bio: app.bio || '',
            course: app.course,
            year: app.year,
            status: 'approved',
            requirements: app.requirements,
          })
          .subscribe(() => {
            this.loadApplications();
            Swal.fire({ icon: 'success', title: 'Candidate Approved!', timer: 1000, showConfirmButton: false });
          });
      });
    });
  }

  // ── Reject / Disqualify application ──────────────────────────
  rejectApplication(app: Application) {
    Swal.fire({
      title: 'Disqualify candidate?',
      text: `${app.name} for ${app.position}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Disqualify',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.svc.updateApplication({ ...app, status: 'rejected' }).subscribe(() => {
        this.loadApplications();
        Swal.fire({ icon: 'info', title: 'Application Disqualified', timer: 1000, showConfirmButton: false });
      });
    });
  }

  // ── Load results for a completed election ─────────────────────
  loadResults(election: Election) {
    this.selectedResultElection = election;
    this.loadingResults = true;
    this.activeTab = 'results';

    this.svc.getCandidates().subscribe((candidates) => {
      const electionCandidates = candidates.filter(
        (c) => (c as any).electionId === election.id || !c.hasOwnProperty('electionId'),
      );

      const map = new Map<string, Candidate[]>();
      for (const c of electionCandidates) {
        if (!map.has(c.position)) map.set(c.position, []);
        map.get(c.position)!.push(c);
      }

      this.resultsByPosition = Array.from(map.entries()).map(([position, cands]) => {
        const sorted = [...cands].sort((a, b) => b.votes - a.votes);
        return { position, candidates: sorted, total: sorted.reduce((s, c) => s + (c.votes || 0), 0) };
      });

      this.loadingResults = false;
    });
  }

  getPercent(votes: number, total: number): number {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  }

  // ── Create ELECOM account ─────────────────────────────────────
  // ADMIN creates ELECOM accounts only — students are created by ELECOM.
  openAccountModal() {
    this.showAccountModal = true;
    this.accountForm = { name: '', email: '', password: '' };
  }

  closeAccountModal() {
    this.showAccountModal = false;
  }

  async createElecomAccount() {
    const { name, email, password } = this.accountForm;
    if (!name || !email || !password) {
      Swal.fire({ icon: 'warning', title: 'Please fill in all required fields.' });
      return;
    }

    this.creatingAccount = true;

    try {
      const credential = await createUserWithEmailAndPassword(this.firebaseAuth, email, password);

      await setDoc(doc(this.firestore, 'users', credential.user.uid), {
        name,
        email,
        role: 'elecom',          // ← always ELECOM, never student
        createdAt: new Date().toISOString(),
      });

      this.creatingAccount = false;
      this.closeAccountModal();

      Swal.fire({
        icon: 'success',
        title: 'ELECOM Account Created!',
        text: `${name} can now log in as Election Committee.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      this.creatingAccount = false;
      if (err.code === 'auth/email-already-in-use') {
        Swal.fire({ icon: 'error', title: 'Email already in use.' });
      } else if (err.code === 'auth/weak-password') {
        Swal.fire({ icon: 'error', title: 'Password must be at least 6 characters.' });
      } else {
        Swal.fire({ icon: 'error', title: 'Failed to create account. Try again.' });
      }
    }
  }

  // ── Getters ───────────────────────────────────────────────────
  get activeElection() { return this.elections.find((e) => e.status === 'active') || null; }
  get upcomingElections() { return this.elections.filter((e) => e.status === 'upcoming'); }
  get completedElections() { return this.elections.filter((e) => e.status === 'completed'); }
  get pendingApplications() { return this.applications.filter((a) => a.status === 'pending'); }

  // ── Create/Edit modal ─────────────────────────────────────────
  openCreate() {
    this.isEditMode = false;
    this.form = { name: '', description: '', startDate: '', endDate: '', totalPositions: 7 };
    this.showModal = true;
  }

  openEdit(e: Election) {
    this.isEditMode = true;
    this.selectedElection = e;
    this.form = {
      name: e.name,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      totalPositions: e.totalPositions,
    };
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  save() {
    if (!this.form.name || !this.form.startDate || !this.form.endDate) return;

    if (this.isEditMode) {
      this.svc.updateElection({ ...(this.selectedElection as Election), ...this.form }).subscribe(() => {
        this.loadElections();
        this.closeModal();
        Swal.fire({ icon: 'success', title: 'Updated!', timer: 1000, showConfirmButton: false });
      });
    } else {
      this.svc
        .addElection({
          ...this.form,
          totalVoters: 0,
          voted: 0,
          status: 'upcoming',
          auditStatus: 'pending',
          createdBy: 'admin',
          createdAt: new Date().toISOString(),
        })
        .subscribe(() => {
          this.loadElections();
          this.closeModal();
          Swal.fire({ icon: 'success', title: 'Election Created!', timer: 1000, showConfirmButton: false });
        });
    }
  }

  // ── Start / End / Delete ──────────────────────────────────────
  start(e: Election) {
    if (this.activeElection) {
      Swal.fire({ icon: 'warning', title: 'An election is already active!' });
      return;
    }
    Swal.fire({
      title: 'Start Election?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      confirmButtonText: 'Yes, Start!',
    }).then((r) => {
      if (r.isConfirmed)
        this.svc.updateElection({ ...e, status: 'active' }).subscribe(() => this.loadElections());
    });
  }

  end(e: Election) {
    Swal.fire({
      title: 'End Election?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, End!',
    }).then((r) => {
      if (r.isConfirmed)
        this.svc.updateElection({ ...e, status: 'completed' }).subscribe(() => this.loadElections());
    });
  }

  delete(e: Election) {
    Swal.fire({
      title: 'Delete?',
      text: `Delete "${e.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    }).then((r) => {
      if (r.isConfirmed) this.svc.deleteElection(e.id).subscribe(() => this.loadElections());
    });
  }

  // ── Audit ─────────────────────────────────────────────────────
  openAudit(e: Election) {
    this.auditElection = e;
    this.auditChecks = [];
    this.auditNote = '';
    this.showAuditModal = true;
    this.runAudit(e);
  }

  closeAudit() {
    this.showAuditModal = false;
    this.auditElection = null;
  }

  runAudit(e: Election) {
    this.auditLoading = true;
    forkJoin({
      records: this.svc.getVoteRecords(),
      voters: this.svc.getVoters(),
      candidates: this.svc.getCandidates(),
    }).subscribe(({ records, voters, candidates }) => {
      const r = records.filter((x) => x.electionId === e.id);
      const c = candidates.filter((x) => (x as any).electionId === e.id);
      const checks: AuditCheck[] = [];

      const ids = r.map((x) => x.studentId);
      const dupes = ids.length - new Set(ids).size;
      checks.push(
        dupes === 0
          ? { label: 'Duplicate Votes', status: 'ok', detail: 'No duplicate votes found.' }
          : { label: 'Duplicate Votes', status: 'error', detail: `${dupes} duplicate vote(s) detected!` },
      );

      checks.push(
        e.voted === r.length
          ? { label: 'Vote Count Integrity', status: 'ok', detail: `Count matches records (${e.voted}/${r.length}).` }
          : { label: 'Vote Count Integrity', status: 'error', detail: `Mismatch! Election: ${e.voted}, Records: ${r.length}.` },
      );

      const regIds = new Set(voters.map((v) => v.studentId));
      const unregistered = r.filter((x) => !regIds.has(x.studentId)).length;
      checks.push(
        unregistered === 0
          ? { label: 'Voter Eligibility', status: 'ok', detail: 'All votes from registered voters.' }
          : { label: 'Voter Eligibility', status: 'warning', detail: `${unregistered} vote(s) from unregistered voters.` },
      );

      const totalVotes = c.reduce((sum, x) => sum + (x.votes || 0), 0);
      checks.push(
        c.length === 0
          ? { label: 'Candidate Totals', status: 'warning', detail: 'No candidates found.' }
          : totalVotes >= r.length
            ? { label: 'Candidate Totals', status: 'ok', detail: `Totals match (${totalVotes}).` }
            : { label: 'Candidate Totals', status: 'error', detail: `Mismatch! Candidates: ${totalVotes}, Records: ${r.length}.` },
      );

      const outside = r.filter((x) => {
        const t = new Date(x.submittedAt).getTime();
        return t < new Date(e.startDate).getTime() || t > new Date(e.endDate).getTime();
      }).length;
      checks.push(
        outside === 0
          ? { label: 'Timeline Integrity', status: 'ok', detail: 'All votes within election period.' }
          : { label: 'Timeline Integrity', status: 'error', detail: `${outside} vote(s) outside election period!` },
      );

      this.auditChecks = checks;
      this.auditLoading = false;
    });
  }

  get auditOverall(): 'clean' | 'warning' | 'flagged' {
    if (this.auditChecks.some((c) => c.status === 'error')) return 'flagged';
    if (this.auditChecks.some((c) => c.status === 'warning')) return 'warning';
    return 'clean';
  }

  certify() {
    if (!this.auditElection) return;
    this.svc
      .updateElection({ ...this.auditElection, auditStatus: 'clean', certifiedAt: new Date().toISOString() })
      .subscribe(() => {
        this.notify('clean');
        this.loadElections();
        this.closeAudit();
        Swal.fire({ icon: 'success', title: 'Election Certified!', timer: 1500, showConfirmButton: false });
      });
  }

  flag() {
    if (!this.auditElection) return;
    if (!this.auditNote.trim()) {
      Swal.fire({ icon: 'warning', title: 'Add a note before flagging.' });
      return;
    }
    this.svc
      .updateElection({ ...this.auditElection, auditStatus: 'flagged', auditNote: this.auditNote })
      .subscribe(() => {
        this.notify('flagged');
        this.loadElections();
        this.closeAudit();
        Swal.fire({ icon: 'warning', title: 'Election Flagged!', text: 'ELECOM has been notified.', timer: 1500, showConfirmButton: false });
      });
  }

  notify(type: 'clean' | 'flagged') {
    if (!this.auditElection) return;
    this.svc
      .addNotification({
        role: 'elecom',
        type,
        title: type === 'clean' ? '✅ Election Certified' : '⚠️ Election Flagged',
        message:
          type === 'clean'
            ? `Admin certified "${this.auditElection.name}". Results are now official.`
            : `Admin flagged "${this.auditElection.name}". Reason: ${this.auditNote}`,
        electionId: this.auditElection.id,
        createdAt: new Date().toISOString(),
        seen: false,
      })
      .subscribe();
  }

  // ── Helpers ───────────────────────────────────────────────────
  statusClass(s: string) {
    return s === 'active' ? 'status-active' : s === 'upcoming' ? 'status-upcoming' : 'status-completed';
  }

  auditClass(s?: string) {
    return s === 'clean' ? 'audit-clean' : s === 'flagged' ? 'audit-flagged' : 'audit-pending';
  }

  checkIcon(s: 'ok' | 'warning' | 'error') {
    return s === 'ok' ? '✅' : s === 'warning' ? '⚠️' : '❌';
  }

  appStatusClass(s: string) {
    return s === 'approved' ? 'status-active' : s === 'rejected' ? 'status-completed' : 'status-upcoming';
  }
}