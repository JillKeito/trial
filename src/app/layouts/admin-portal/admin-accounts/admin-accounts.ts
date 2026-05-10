import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElecomAccount } from '../../../services/elecom-account';
import Swal from 'sweetalert2';

@Component({
  selector: 'admin-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-accounts.html',
  styleUrls: ['./admin-accounts.scss'],
})
export class AdminAccounts {
  showAccountModal = false;
  creatingAccount = false;
  accountForm = { name: '', username: '', email: '', password: '' };

  constructor(private elecomAccSvc: ElecomAccount) {}

  openAccountModal() {
    this.showAccountModal = true;
    this.accountForm = { name: '', username: '', email: '', password: '' };
  }

  closeAccountModal() {
    this.showAccountModal = false;
  }

  async createElecomAccount() {
    const f = this.accountForm;
    if (!f.name || !f.username || !f.email || !f.password) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Required Fields',
        text: 'All fields are required.',
      });
      return;
    }
    this.creatingAccount = true;
    try {
      await this.elecomAccSvc.createElecomAccount({
        name: f.name,
        username: f.username,
        email: f.email,
        password: f.password,
      });
      this.creatingAccount = false;
      this.closeAccountModal();
      Swal.fire({
        icon: 'success',
        title: 'ELECOM Account Created!',
        text: `${f.name} can now log in as Election Commissioner.`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      this.creatingAccount = false;
      Swal.fire({
        icon: 'error',
        title: 'Failed to Create Account',
        text: err.message || 'Something went wrong.',
      });
    }
  }
}