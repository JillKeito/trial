import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Election, Application } from '../../../../services/election';
import { AuthService } from '../../../../services/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-student-apply',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-apply.html',
  styleUrls: ['./student-apply.scss'],
})
export class StudentApply implements OnInit {
  Math = Math;

  currentStep = 1;
  submittedData: any = null;
  submitting = false;

  elections: Election[] = [];
  activeElection: Election | null = null;

  existingApplication: Application | null = null;

  parties: string[] = [
    'UNITY',
    'PROGRESSIVE ALLIANCE',
    'STUDENT FIRST',
    'LEADERSHIP PARTY',
    'INDEPENDENT',
  ];
  courses: string[] = ['BSIT', 'TCM', 'EMT'];
  positions: string[] = [
    'President',
    'Vice President',
    'Secretary',
    'Treasurer',
    'Auditor',
    'PRO / PIO',
    'Senator',
  ];
  years: number[] = [1, 2, 3];

  form: any = this.blankForm();
  photoPreview: string | null = null;

  constructor(
    private svc: ElectionService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    // load all open elections for the student to choose from
    this.svc.getElections().subscribe((elections) => {
      this.elections = elections.filter((e) => e.status === 'active' || e.status === 'upcoming');
      // keep activeElection as fallback (first active one)
      this.activeElection = this.elections[0] || null;
    });

    // check if student already applied (any election)
    const user = this.auth.getCurrentUser();
    if (user) {
      const lookupId = (user as any).studentId || user.id;
      this.svc.getApplicationByStudentId(lookupId).subscribe((apps) => {
        // will re-check per election once student selects one
        this.existingApplication = null;
        // if they already applied to one, pre-select that election and show confirmation
        if (apps && apps.length > 0) {
          this.existingApplication = apps[0];
          this.submittedData = {
            name: this.existingApplication!.name,
            position: this.existingApplication!.position,
            party: this.existingApplication!.party,
            course: this.existingApplication!.course,
            year: this.existingApplication!.year,
            electionId: (this.existingApplication as any).electionId || '',
            reqCount: this.countReqs(this.existingApplication!.requirements),
          };
          this.currentStep = 4;
        }
      });
    }
  }

  // called when student changes the election selection
  onElectionChange(): void {
    const user = this.auth.getCurrentUser();
    if (!user || !this.form.electionId) return;
    const lookupId = (user as any).studentId || user.id;
    this.svc.getApplicationByStudentId(lookupId).subscribe((apps) => {
      const match = apps.find((a: any) => a.electionId === this.form.electionId);
      this.existingApplication = match || null;
      if (this.existingApplication) {
        this.submittedData = {
          name: this.existingApplication!.name,
          position: this.existingApplication!.position,
          party: this.existingApplication!.party,
          course: this.existingApplication!.course,
          year: this.existingApplication!.year,
          electionId: this.form.electionId,
          reqCount: this.countReqs(this.existingApplication!.requirements),
        };
        this.currentStep = 4;
      }
    });
  }

  get selectedElectionName(): string {
    return this.elections.find((e) => e.id === this.form.electionId)?.name || '';
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.photoPreview = e.target?.result as string;
      this.form.photoUrl = this.photoPreview;
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.photoPreview = null;
    this.form.photoUrl = '';
  }

  blankForm() {
    return {
      name: '',
      party: null,
      position: null,
      course: null,
      year: null,
      bio: '',
      age: null as number | null,
      photoUrl: '',
      electionId: '',
      status: 'pending',
      requirements: {
        enrollment: false,
        goodMoral: false,
        residency: false,
        coc: false,
        noViolations: false,
        noFailingGrades: false,
      },
    };
  }

  getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  reqCount(): number {
    return Object.values(this.form.requirements).filter(Boolean).length;
  }

  // count reqs from saved application
  countReqs(reqs: any): number {
    if (!reqs) return 0;
    return Object.values(reqs).filter(Boolean).length;
  }

  nextStep(): void {
    if (this.currentStep < 3) this.currentStep++;
  }

  prevStep(): void {
    if (this.currentStep > 1) this.currentStep--;
  }

  // ── Submit to Firestore ──────────────────────────────────────
  // ACID: Atomicity — entire application saves as one document
  // If it fails, nothing is saved (no partial data)
  submitApplication(): void {
    if (!this.form.electionId) {
      Swal.fire({ icon: 'warning', title: 'Please select an election to apply for.' });
      return;
    }
    if (!this.form.name || !this.form.position || !this.form.course) {
      Swal.fire({ icon: 'warning', title: 'Please fill in all required fields.' });
      return;
    }

    const user = this.auth.getCurrentUser();
    if (!user) {
      Swal.fire({ icon: 'error', title: 'You must be logged in to apply.' });
      return;
    }

    // ── Prevent duplicate submissions ─────────────────────────
    if (this.existingApplication) {
      Swal.fire({
        icon: 'info',
        title: 'Already Applied',
        text: 'You have already submitted an application for this election.',
      });
      this.currentStep = 4;
      return;
    }

    this.submitting = true;

    // build the application object
    const application: Omit<Application, 'id'> = {
      studentId: (user as any).studentId || user.id, // use studentId not email
      studentName: user.name,
      name: this.form.name,
      course: this.form.course,
      year: this.form.year || '',
      position: this.form.position,
      party: this.form.party || 'Independent',
      bio: this.form.bio || '',
      awards: '',
      photo: '',
      supportingDoc: '',
      status: 'pending', // always starts as pending
      submittedAt: new Date().toISOString(),
      electionId: this.form.electionId || this.activeElection?.id || '',
      requirements: this.form.requirements,
      age: this.form.age || null,
      photoUrl: this.form.photoUrl || '',
    };

    // save to Firestore /applications collection
    this.svc.submitApplication(application).subscribe({
      next: () => {
        this.submitting = false;

        // snapshot for confirmation step
        this.submittedData = {
          name: this.form.name,
          position: this.form.position,
          party: this.form.party || 'Independent',
          course: this.form.course,
          year: this.form.year,
          electionId: this.form.electionId,
          reqCount: this.reqCount(),
        };

        Swal.fire({
          icon: 'success',
          title: 'Application Submitted!',
          text: 'Your candidacy is now under review.',
          timer: 1500,
          showConfirmButton: false,
        });

        // go to confirmation step
        this.currentStep = 4;
      },
      error: (err) => {
        this.submitting = false;
        console.error('Submit error:', err);
        Swal.fire({ icon: 'error', title: 'Failed to submit. Please try again.' });
      },
    });
  }
}
