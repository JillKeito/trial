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

  // active election from Firestore
  activeElection: Election | null = null;

  // existing application check
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
  years: number[] = [1, 2, 3, 4];

  form: any = this.blankForm();

  constructor(
    private svc: ElectionService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    // get active election so we can link application to it
    this.svc.getElections().subscribe((elections) => {
      this.activeElection =
        elections.find((e) => e.status === 'active' || e.status === 'upcoming') || null;
    });

    // check if student already applied
    const user = this.auth.getCurrentUser();
    if (user) {
      this.svc.getApplicationByStudentId(user.email).subscribe((apps) => {
        this.existingApplication = apps[0] || null;
        // if already applied, jump to confirmation step
        if (this.existingApplication) {
          this.submittedData = {
            name: this.existingApplication.name,
            position: this.existingApplication.position,
            party: this.existingApplication.party,
            course: this.existingApplication.course,
            year: this.existingApplication.year,
            reqCount: this.countReqs(this.existingApplication.requirements),
          };
          this.currentStep = 4;
        }
      });
    }
  }

  blankForm() {
    return {
      name: '',
      party: null,
      position: null,
      course: null,
      year: null,
      bio: '',
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
    if (!this.form.name || !this.form.position || !this.form.course) {
      Swal.fire({ icon: 'warning', title: 'Please fill in all required fields.' });
      return;
    }

    const user = this.auth.getCurrentUser();
    if (!user) {
      Swal.fire({ icon: 'error', title: 'You must be logged in to apply.' });
      return;
    }

    this.submitting = true;

    // build the application object
    const application: Omit<Application, 'id'> = {
      studentId: user.email, // use email as studentId
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
      electionId: this.activeElection?.id || '', // link to active election
      requirements: this.form.requirements,
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
