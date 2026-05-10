import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Candidate, Election } from '../../../../services/election';
import Swal from 'sweetalert2';

const USG_POSITIONS = [
  'President', 'Vice President', 'Secretary',
  'Treasurer', 'Auditor', 'PRO / PIO', 'Senator'
];

const COURSES = ['BSIT', 'BSTCM', 'BSEMT'];

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candidates.html',
  styleUrl: './candidates.scss',
})
export class Candidates implements OnInit {

  candidates: Candidate[] = [];
  elections: Election[] = [];
  showCandidateModal = false;
  showAssignModal = false;
  assigningCandidate: Candidate | null = null;
  selectedElectionId = '';
  loading = false;
  candidateFilter: 'all' | 'pending' | 'approved' | 'disqualified' = 'all';

  positions = USG_POSITIONS;
  years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  courses = COURSES;

  newCandidate = {
    name: '', position: USG_POSITIONS[0], course: COURSES[0], year: '1st Year',
    party: '', bio: '', photo: '', votes: 0,
    status: 'pending' as 'pending',
    requirements: {
      enrollment: false, goodMoral: false, residency: false,
      coc: false, noViolations: false, noFailingGrades: false
    }
  };

  constructor(private svc: ElectionService) {}

  ngOnInit(): void {
    this.loadCandidates();
    this.loadElections();
  }

  loadCandidates(): void {
    this.loading = true;
    this.svc.getCandidates().subscribe(c => {
      this.candidates = c;
      this.loading = false;
    });
  }

  loadElections(): void {
    this.svc.getElections().subscribe(e => {
      // Only approved + upcoming elections are valid assignment targets
      this.elections = e.filter(el => el.approvalStatus === 'approved' && el.status === 'upcoming');
    });
  }

  get filteredCandidates(): Candidate[] {
    if (this.candidateFilter === 'all') return this.candidates;
    return this.candidates.filter(c => c.status === this.candidateFilter);
  }

  get totalCandidates(): number { return this.candidates.length; }
  get approvedCount(): number   { return this.candidates.filter(c => c.status === 'approved').length; }
  get pendingCount(): number    { return this.candidates.filter(c => c.status === 'pending').length; }

  requirementsMet(req: Candidate['requirements']): boolean {
    return req ? Object.values(req).every(Boolean) : false;
  }

  reqCount(req: Candidate['requirements']): number {
    return req ? Object.values(req).filter(Boolean).length : 0;
  }

  getElectionName(electionId: string | undefined): string {
    if (!electionId) return '';
    const el = this.elections.find(e => e.id === electionId) ||
               this.allElections.find(e => e.id === electionId);
    return el ? el.name : '';
  }

  allElections: Election[] = [];

  approveCandidate(c: Candidate): void {
    const updated: Candidate = { ...c, status: 'approved' };
    this.svc.updateCandidate(updated).subscribe(() => this.loadCandidates());
  }

  openAssignModal(c: Candidate): void {
    this.assigningCandidate = c;
    this.selectedElectionId = c.electionId || '';
    this.showAssignModal = true;
  }

  confirmAssign(): void {
    if (!this.assigningCandidate || !this.selectedElectionId) return;
    const updated: Candidate = { ...this.assigningCandidate, electionId: this.selectedElectionId };
    this.svc.updateCandidate(updated).subscribe(() => {
      this.loadCandidates();
      this.showAssignModal = false;
      this.assigningCandidate = null;
      Swal.fire({ icon: 'success', title: 'Assigned!', text: 'Candidate has been assigned to the election.', timer: 1500, showConfirmButton: false });
    });
  }

  removeAssignment(c: Candidate): void {
    Swal.fire({
      title: 'Remove Assignment?',
      text: `${c.name} will be unassigned from the election.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Remove',
    }).then(r => {
      if (r.isConfirmed) {
        const updated: Candidate = { ...c, electionId: undefined };
        this.svc.updateCandidate(updated).subscribe(() => this.loadCandidates());
      }
    });
  }

  disqualifyCandidate(c: Candidate): void {
    Swal.fire({
      title: 'Disqualify candidate?',
      text: `${c.name} will be removed from the ballot.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Disqualify'
    }).then(r => {
      if (r.isConfirmed) {
        const updated: Candidate = { ...c, status: 'disqualified', electionId: undefined };
        this.svc.updateCandidate(updated).subscribe(() => this.loadCandidates());
      }
    });
  }

  deleteCandidate(c: Candidate): void {
    Swal.fire({
      title: 'Delete candidate?',
      text: `Remove ${c.name} permanently?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete'
    }).then(r => {
      if (r.isConfirmed) {
        this.svc.deleteCandidate(c.id).subscribe(() => this.loadCandidates());
      }
    });
  }

  addCandidateSubmit(): void {
    if (!this.newCandidate.name || !this.newCandidate.course) return;
    const allReq = this.requirementsMet(this.newCandidate.requirements);
    const c: Omit<Candidate, 'id'> = { ...this.newCandidate, status: allReq ? 'approved' : 'pending' };
    this.svc.addCandidate(c).subscribe(() => {
      this.loadCandidates();
      this.showCandidateModal = false;
      this.resetForm();
    });
  }

  resetForm(): void {
    this.newCandidate = {
      name: '', position: USG_POSITIONS[0], course: '', year: '1st Year',
      party: '', bio: '', photo: '', votes: 0, status: 'pending',
      requirements: {
        enrollment: false, goodMoral: false, residency: false,
        coc: false, noViolations: false, noFailingGrades: false
      }
    };
  }
}