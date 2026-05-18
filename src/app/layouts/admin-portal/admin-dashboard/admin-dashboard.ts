import { Component, OnInit, OnDestroy, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Election, Application, Candidate } from '../../../services/election';
import { AuthService } from '../../../services/auth';
import { forkJoin, Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Chart, ArcElement, DoughnutController, Tooltip, Legend } from 'chart.js';

Chart.register(ArcElement, DoughnutController, Tooltip, Legend);

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
export class AdminDashboard implements OnInit, OnDestroy, AfterViewChecked {
  private firebaseAuth = inject(Auth);
  private firestore = inject(Firestore);

  elections: Election[] = [];
  loading = false;
  applications: Application[] = [];
  loadingApps = false;

  resultsByPosition: { position: string; candidates: Candidate[]; total: number }[] = [];
  loadingResults = false;
  selectedResultElection: Election | null = null;

  showAccountModal = false;
  accountForm = { name: '', email: '', password: '' };
  creatingAccount = false;

  showModal = false;
  isEditMode = false;
  selectedElection: Partial<Election> = {};
  form = { name: '', description: '', startDate: '', endDate: '', totalPositions: 7 };

  showAuditModal = false;
  auditElection: Election | null = null;
  auditChecks: AuditCheck[] = [];
  auditLoading = false;
  auditNote = '';

  private charts: Map<string, Chart> = new Map();
  private chartsNeedRender = false;

  pieColors = [
    '#f59e0b',
    '#185fa5',
    '#1d9e75',
    '#8b5cf6',
    '#ef4444',
    '#0ea5e9',
    '#10b981',
    '#f97316',
    '#ec4899',
    '#6366f1',
  ];

  private subs = new Subscription();

  constructor(
    private svc: ElectionService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.subs.add(
      this.svc.getElections().subscribe((e) => {
        const now = new Date();
        this.elections = e.map((el) => {
          const start = new Date(el.startDate);
          const end = new Date(el.endDate);
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return el;
          const correct: 'upcoming' | 'active' | 'completed' =
            now < start ? 'upcoming' : now <= end ? 'active' : 'completed';
          if (el.status !== correct && el.auditStatus !== 'clean') {
            this.svc.updateElection({ ...el, status: correct }).subscribe();
            return { ...el, status: correct };
          }
          return el;
        });
        this.loading = false;
        if (this.selectedResultElection) {
          const updated = e.find((el) => el.id === this.selectedResultElection!.id);
          if (updated) this.selectedResultElection = updated;
        }
      }),
    );

    this.subs.add(
      this.svc.getApplications().subscribe((apps) => {
        this.applications = apps;
        this.loadingApps = false;
      }),
    );

    this.subs.add(
      this.svc.getCandidates().subscribe((allCandidates) => {
        if (!this.selectedResultElection) return;
        const filtered = allCandidates.filter(
          (c) => (c as any).electionId === this.selectedResultElection!.id,
        );
        const map = new Map<string, Candidate[]>();
        for (const c of filtered) {
          if (!map.has(c.position)) map.set(c.position, []);
          map.get(c.position)!.push(c);
        }
        this.resultsByPosition = Array.from(map.entries()).map(([position, cands]) => {
          const sorted = [...cands].sort((a, b) => b.votes - a.votes);
          return {
            position,
            candidates: sorted,
            total: sorted.reduce((s, c) => s + (c.votes || 0), 0),
          };
        });
        this.loadingResults = false;
        this.chartsNeedRender = true;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.destroyAllCharts();
  }

  ngAfterViewChecked(): void {
    if (this.chartsNeedRender && this.resultsByPosition.length > 0) {
      this.chartsNeedRender = false;
      setTimeout(() => this.renderPieCharts(), 50);
    }
  }

  // ── Results ───────────────────────────────────────────────────
  loadResults(election: Election): void {
    this.selectedResultElection = election;
    this.loadingResults = true;
    this.destroyAllCharts();
    this.resultsByPosition = [];

    this.svc.getCandidates().subscribe((allCandidates) => {
      const filtered = allCandidates.filter((c) => (c as any).electionId === election.id);
      const map = new Map<string, Candidate[]>();
      for (const c of filtered) {
        if (!map.has(c.position)) map.set(c.position, []);
        map.get(c.position)!.push(c);
      }
      this.resultsByPosition = Array.from(map.entries()).map(([position, cands]) => {
        const sorted = [...cands].sort((a, b) => b.votes - a.votes);
        return {
          position,
          candidates: sorted,
          total: sorted.reduce((s, c) => s + (c.votes || 0), 0),
        };
      });
      this.loadingResults = false;
      this.chartsNeedRender = true;
    });
  }

  // ── Pie charts ────────────────────────────────────────────────
  renderPieCharts(): void {
    this.resultsByPosition.forEach((group, i) => {
      const canvasId = `pie-admin-${i}`;
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      const existing = this.charts.get(canvasId);
      if (existing) {
        existing.destroy();
        this.charts.delete(canvasId);
      }
      const labels = group.candidates.map((c) => c.name);
      const data = group.candidates.map((c) => c.votes || 0);
      const colors = group.candidates.map((_, j) => this.pieColors[j % this.pieColors.length]);
      const hasVotes = data.some((v) => v > 0);
      const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: hasVotes ? data : group.candidates.map(() => 1),
              backgroundColor: hasVotes ? colors : colors.map((c) => c + '55'),
              borderColor: '#ffffff',
              borderWidth: 3,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: false,
          cutout: '62%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  if (!hasVotes) return ' No votes yet';
                  const val = ctx.parsed as number;
                  const pct = group.total > 0 ? Math.round((val / group.total) * 100) : 0;
                  return ` ${val} votes (${pct}%)`;
                },
              },
            },
          },
        },
      });
      this.charts.set(canvasId, chart);
    });
  }

  destroyAllCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts.clear();
  }

  // ── Applications ──────────────────────────────────────────────
  // FIX: removed registeredAt/registeredBy — not on Candidate interface
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
            photo: app.photo || (app as any).photoUrl || '',
            votes: 0,
            bio: app.bio || '',
            course: app.course,
            year: app.year,
            status: 'approved',
            requirements: app.requirements,
            electionId: app.electionId,
            organization: (app as any).organization || '',
          } as any)
          .subscribe(() => {
            this.svc
              .addAuditLog({
                action: 'CANDIDATE_APPROVED',
                performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
                details: `Approved ${app.name} for ${app.position} in election ${app.electionId}`,
                targetId: app.id,
                createdAt: new Date().toISOString(),
              })
              .subscribe();
            Swal.fire({
              icon: 'success',
              title: 'Candidate Approved!',
              timer: 1000,
              showConfirmButton: false,
            });
          });
      });
    });
  }

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
        this.svc
          .addAuditLog({
            action: 'CANDIDATE_DISQUALIFIED',
            performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
            details: `Disqualified ${app.name} for ${app.position}`,
            targetId: app.id,
            createdAt: new Date().toISOString(),
          })
          .subscribe();
        Swal.fire({
          icon: 'info',
          title: 'Application Disqualified',
          timer: 1000,
          showConfirmButton: false,
        });
      });
    });
  }

  // ── Getters ───────────────────────────────────────────────────
  get activeElection() {
    return this.elections.find((e) => e.status === 'active') || null;
  }
  get upcomingElections() {
    return this.elections.filter((e) => e.status === 'upcoming');
  }
  get completedElections() {
    return this.elections.filter((e) => e.status === 'completed');
  }
  get pendingApplications() {
    return this.applications.filter((a) => a.status === 'pending');
  }

  getPercent(votes: number, total: number): number {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  }
  getWinner(group: { candidates: Candidate[] }): Candidate {
    return group.candidates[0] ?? ({ name: '—', votes: 0 } as any);
  }
  isWinner(c: Candidate, group: { candidates: Candidate[] }): boolean {
    return group.candidates[0]?.id === c.id && c.votes > 0;
  }

  // ── Election modal ────────────────────────────────────────────
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

  closeModal() {
    this.showModal = false;
  }

  save() {
    if (!this.form.name || !this.form.startDate || !this.form.endDate) return;
    const start = new Date(this.form.startDate);
    const end = new Date(this.form.endDate);
    const now = new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid dates',
        text: 'Please enter valid start and end dates.',
      });
      return;
    }
    if (end <= start) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid date range',
        text: 'End date must be after start date.',
      });
      return;
    }
    const computedStatus: 'upcoming' | 'active' | 'completed' =
      now < start ? 'upcoming' : now <= end ? 'active' : 'completed';

    if (this.isEditMode) {
      this.svc
        .updateElection({
          ...(this.selectedElection as Election),
          ...this.form,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          status: computedStatus,
        })
        .subscribe(() => {
          this.svc
            .addAuditLog({
              action: 'ELECTION_UPDATED',
              performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
              details: `Updated election "${this.form.name}"`,
              targetId: (this.selectedElection as Election).id,
              createdAt: new Date().toISOString(),
            })
            .subscribe();
          this.closeModal();
          Swal.fire({ icon: 'success', title: 'Updated!', timer: 1000, showConfirmButton: false });
        });
    } else {
      this.svc
        .addElection({
          ...this.form,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          totalVoters: 0,
          voted: 0,
          status: computedStatus,
          auditStatus: 'pending',
          createdBy: 'admin',
          createdAt: new Date().toISOString(),
        })
        .subscribe(() => {
          this.svc
            .addAuditLog({
              action: 'ELECTION_CREATED',
              performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
              details: `Created election "${this.form.name}"`,
              createdAt: new Date().toISOString(),
            })
            .subscribe();
          this.closeModal();
          Swal.fire({
            icon: 'success',
            title: 'Election Created!',
            timer: 1000,
            showConfirmButton: false,
          });
        });
    }
  }

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
      if (!r.isConfirmed) return;
      this.svc.updateElection({ ...e, status: 'active' }).subscribe(() => {
        this.svc
          .addAuditLog({
            action: 'ELECTION_STARTED',
            performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
            details: `Started election "${e.name}"`,
            targetId: e.id,
            createdAt: new Date().toISOString(),
          })
          .subscribe();
      });
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
      if (!r.isConfirmed) return;
      this.svc.updateElection({ ...e, status: 'completed' }).subscribe(() => {
        this.svc
          .addAuditLog({
            action: 'ELECTION_ENDED',
            performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
            details: `Ended election "${e.name}"`,
            targetId: e.id,
            createdAt: new Date().toISOString(),
          })
          .subscribe();
      });
    });
  }

  delete(e: Election) {
    const isActive = e.status === 'active';
    Swal.fire({
      title: isActive ? '⚠️ Delete Active Election?' : 'Delete Election?',
      text: isActive
        ? `"${e.name}" is currently LIVE. Deleting will stop all ongoing voting immediately. This cannot be undone.`
        : `Delete "${e.name}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: isActive ? 'Yes, delete anyway' : 'Delete',
      cancelButtonText: 'Cancel',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.svc.deleteElection(e.id).subscribe(() => {
        this.svc
          .addAuditLog({
            action: 'ELECTION_DELETED',
            performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
            details: `Deleted ${isActive ? 'ACTIVE ' : ''}election "${e.name}"`,
            targetId: e.id,
            createdAt: new Date().toISOString(),
          })
          .subscribe();
      });
    });
  }

  // ── Account modal ─────────────────────────────────────────────
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
        role: 'elecom',
        createdAt: new Date().toISOString(),
      });
      this.svc
        .addAuditLog({
          action: 'ELECOM_ACCOUNT_CREATED',
          performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
          details: `Created ELECOM account for ${name} (${email})`,
          createdAt: new Date().toISOString(),
        })
        .subscribe();
      this.creatingAccount = false;
      this.closeAccountModal();
      Swal.fire({
        icon: 'success',
        title: 'ELECOM Account Created!',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      this.creatingAccount = false;
      if (err.code === 'auth/email-already-in-use')
        Swal.fire({ icon: 'error', title: 'Email already in use.' });
      else if (err.code === 'auth/weak-password')
        Swal.fire({ icon: 'error', title: 'Password must be at least 6 characters.' });
      else Swal.fire({ icon: 'error', title: 'Failed to create account. Try again.' });
    }
  }

  // ── Audit modal ───────────────────────────────────────────────
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
          : {
              label: 'Duplicate Votes',
              status: 'error',
              detail: `${dupes} duplicate vote(s) detected!`,
            },
      );

      checks.push(
        e.voted === r.length
          ? {
              label: 'Vote Count Integrity',
              status: 'ok',
              detail: `Count matches records (${e.voted}/${r.length}).`,
            }
          : {
              label: 'Vote Count Integrity',
              status: 'error',
              detail: `Mismatch! Election: ${e.voted}, Records: ${r.length}.`,
            },
      );

      const regIds = new Set(voters.map((v) => v.studentId));
      const unregistered = r.filter((x) => !regIds.has(x.studentId)).length;
      checks.push(
        unregistered === 0
          ? {
              label: 'Voter Eligibility',
              status: 'ok',
              detail: 'All votes from registered voters.',
            }
          : {
              label: 'Voter Eligibility',
              status: 'warning',
              detail: `${unregistered} vote(s) from unregistered voters.`,
            },
      );

      const totalVotes = c.reduce((sum, x) => sum + (x.votes || 0), 0);
      checks.push(
        c.length === 0
          ? { label: 'Candidate Totals', status: 'warning', detail: 'No candidates found.' }
          : totalVotes >= r.length
            ? { label: 'Candidate Totals', status: 'ok', detail: `Totals match (${totalVotes}).` }
            : {
                label: 'Candidate Totals',
                status: 'error',
                detail: `Mismatch! Candidates: ${totalVotes}, Records: ${r.length}.`,
              },
      );

      const outside = r.filter((x) => {
        const t = new Date(x.submittedAt).getTime();
        return t < new Date(e.startDate).getTime() || t > new Date(e.endDate).getTime();
      }).length;
      checks.push(
        outside === 0
          ? {
              label: 'Timeline Integrity',
              status: 'ok',
              detail: 'All votes within election period.',
            }
          : {
              label: 'Timeline Integrity',
              status: 'error',
              detail: `${outside} vote(s) outside election period!`,
            },
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
      .updateElection({
        ...this.auditElection,
        auditStatus: 'clean',
        certifiedAt: new Date().toISOString(),
      })
      .subscribe(() => {
        this.svc
          .addAuditLog({
            action: 'ELECTION_CERTIFIED',
            performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
            details: `Certified election "${this.auditElection!.name}"`,
            targetId: this.auditElection!.id,
            createdAt: new Date().toISOString(),
          })
          .subscribe();
        this.notify('clean');
        this.closeAudit();
        Swal.fire({
          icon: 'success',
          title: 'Election Certified!',
          timer: 1500,
          showConfirmButton: false,
        });
      });
  }

  flag() {
    if (!this.auditElection) return;
    if (!this.auditNote.trim()) {
      Swal.fire({ icon: 'warning', title: 'Add a note before flagging.' });
      return;
    }
    this.svc
      .updateElection({
        ...this.auditElection,
        auditStatus: 'flagged',
        auditNote: this.auditNote,
      })
      .subscribe(() => {
        this.svc
          .addAuditLog({
            action: 'ELECTION_FLAGGED',
            performedBy: this.auth.getCurrentUser()?.name ?? 'Admin',
            details: `Flagged election "${this.auditElection!.name}". Reason: ${this.auditNote}`,
            targetId: this.auditElection!.id,
            createdAt: new Date().toISOString(),
          })
          .subscribe();
        this.notify('flagged');
        this.closeAudit();
        Swal.fire({
          icon: 'warning',
          title: 'Election Flagged!',
          timer: 1500,
          showConfirmButton: false,
        });
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
            ? `Admin certified "${this.auditElection.name}".`
            : `Admin flagged "${this.auditElection.name}". Reason: ${this.auditNote}`,
        electionId: this.auditElection.id,
        createdAt: new Date().toISOString(),
        seen: false,
      })
      .subscribe();
  }

  // ── Helpers ───────────────────────────────────────────────────
  statusClass(s: string) {
    return s === 'active'
      ? 'status-active'
      : s === 'upcoming'
        ? 'status-upcoming'
        : 'status-completed';
  }
  auditClass(s?: string) {
    return s === 'clean' ? 'audit-clean' : s === 'flagged' ? 'audit-flagged' : 'audit-pending';
  }
  checkIcon(s: string) {
    return s === 'ok' ? '✅' : s === 'warning' ? '⚠️' : '❌';
  }
  appStatusClass(s: string) {
    return s === 'approved'
      ? 'status-active'
      : s === 'rejected'
        ? 'status-completed'
        : 'status-upcoming';
  }
}
