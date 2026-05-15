import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-help',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-help.html',
  styleUrls: ['./admin-help.scss'],
})
export class AdminHelp {
  faqs = [
    {
      q: 'How do I create an election?',
      a: 'Go to Elections in the sidebar, then click "+ Create Election". Fill in the name, dates, and number of positions.',
      open: false,
    },
    {
      q: 'How do I approve a candidate?',
      a: 'Go to Manage Candidates → Student Applications tab. Click the green checkmark to approve or red X to disqualify.',
      open: false,
    },
    {
      q: 'How do I start an election?',
      a: 'Go to Elections, find the upcoming election, and click the "Start" button. Only one election can be active at a time.',
      open: false,
    },
    {
      q: 'What is an Audit Log?',
      a: 'Audit Logs record every admin action with timestamps so you can track who did what and when for accountability.',
      open: false,
    },
    {
      q: 'How do I certify election results?',
      a: 'After an election ends, go to the Results section or click "Audit" on the election. Run the audit checks then click "Certify".',
      open: false,
    },
    {
      q: 'How do I create an ELECOM account?',
      a: 'Click "+ Create ELECOM" in the top header of the dashboard. Fill in the name, email, and password.',
      open: false,
    },
  ];

  toggle(faq: any) {
    faq.open = !faq.open;
  }
}
