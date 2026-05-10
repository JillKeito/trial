import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ElectionService, Election } from '../../../../services/election';
import { AuthService } from '../../../../services/auth';

@Component({
  selector: 'app-student-elections',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-elections.html',
  styleUrl: './student-elections.scss',
})
export class StudentElections implements OnInit {
  elections: Election[] = [];
  loading = true;

  constructor(
    private svc: ElectionService,
    private router: Router,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.svc.getElections().subscribe((elections) => {
      // Only show elections that have been approved by admin
      this.elections = elections.filter(e => e.approvalStatus === 'approved');
      this.loading = false;
    });
  }

  goToBallot(election: Election): void {
    this.router.navigate(['/app/student-ballot', election.id]);
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      active: 'Active',
      upcoming: 'Upcoming',
      completed: 'Completed',
    };
    return map[status] ?? status;
  }

  canVote(election: Election): boolean {
    return election.status === 'active';
  }
}