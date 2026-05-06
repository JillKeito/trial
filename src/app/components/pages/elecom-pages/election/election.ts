import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectionService, Election } from '../../../../services/election';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-elections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './election.html',
  styleUrl: './election.scss',
})
export class Elections implements OnInit {
  elections: Election[] = [];
  showModal = false;
  showViewModal = false;
  isEditMode = false;
  viewingElection: Election | null = null;
  loading = false;

  currentElection: Partial<Election> = this.emptyElection();

  constructor(private svc: ElectionService) {}

  ngOnInit(): void {
    this.loadElections();
  }

  loadElections(): void {
    this.loading = true;
    this.svc.getElections().subscribe((e) => {
      this.elections = e;
      this.loading = false;
    });
  }

  get activeElection(): Election | null {
    return this.elections.find((e) => e.status === 'active') || null;
  }

  get turnoutPercent(): number {
    if (!this.activeElection || this.activeElection.totalVoters === 0) return 0;
    return Math.round((this.activeElection.voted / this.activeElection.totalVoters) * 100);
  }

  getTurnout(e: Election): number {
    return e.totalVoters > 0 ? Math.round((e.voted / e.totalVoters) * 100) : 0;
  }

  getStatusLabel(status: string): string {
    return (
      (
        { upcoming: 'Upcoming', active: 'Active', completed: 'Completed' } as Record<string, string>
      )[status] ?? status
    );
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentElection = this.emptyElection();
    this.showModal = true;
  }

  editElection(e: Election): void {
    this.isEditMode = true;
    this.currentElection = { ...e };
    this.showModal = true;
  }

  viewElection(e: Election): void {
    this.viewingElection = e;
    this.showViewModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }
  closeViewModal(): void {
    this.showViewModal = false;
    this.viewingElection = null;
  }

  saveElection(): void {
    if (
      !this.currentElection.name ||
      !this.currentElection.startDate ||
      !this.currentElection.endDate
    )
      return;

    if (this.isEditMode && this.currentElection.id) {
      this.svc.updateElection(this.currentElection as Election).subscribe(() => {
        this.loadElections();
        this.closeModal();
      });
    } else {
      // ✅ removed markAllRead, markNotificationRead, getNotifications
      const newElection: Omit<Election, 'id'> = {
        name: this.currentElection.name!,
        description: this.currentElection.description || '',
        startDate: this.currentElection.startDate!,
        endDate: this.currentElection.endDate!,
        totalPositions: this.currentElection.totalPositions || 7,
        totalVoters: 0,
        voted: 0,
        status: this.currentElection.status || 'upcoming',
      };
      this.svc.addElection(newElection).subscribe(() => {
        this.loadElections();
        this.closeModal();
      });
    }
  }

  startElection(e: Election): void {
    if (this.activeElection) {
      Swal.fire({
        icon: 'warning',
        title: 'An election is already active!',
        text: 'End the current election first.',
      });
      return;
    }
    this.svc.updateElection({ ...e, status: 'active' }).subscribe(() => this.loadElections());
  }

  endElection(e: Election): void {
    Swal.fire({
      title: 'End Election?',
      text: 'This will close voting and finalize results.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#7B1C2E',
      confirmButtonText: 'End Election',
    }).then((r) => {
      if (r.isConfirmed)
        this.svc
          .updateElection({ ...e, status: 'completed' })
          .subscribe(() => this.loadElections());
    });
  }

  deleteElection(e: Election): void {
    Swal.fire({
      title: 'Delete election?',
      text: `Permanently delete "${e.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#7B1C2E',
      confirmButtonText: 'Delete',
    }).then((r) => {
      if (r.isConfirmed) this.svc.deleteElection(e.id).subscribe(() => this.loadElections());
    });
  }

  private emptyElection(): Partial<Election> {
    return {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      totalPositions: 7,
      status: 'upcoming',
    };
  }
}
