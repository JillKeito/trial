import { Routes } from '@angular/router';

import { LoginComponent } from './components/auth/login/login';

import { AuthGuard } from './components/guard/auth.guard';
import { RoleGuard } from './components/guard/role-guard';

import { MainLayout } from './layouts/main-layout/main-layout';

/* =========================
   ELECOM
========================= */

import { ElecomDashboard } from './layouts/elecom-portal/elecom-dashboard/elecom-dashboard';
import { ElecomNotif } from './layouts/elecom-portal/elecom-notif/elecom-notif';
import { ElecomSettings } from './layouts/elecom-portal/elecom-settings/elecom-settings';

import { Candidates } from './components/pages/elecom-pages/candidates/candidates';
import { Elections } from './components/pages/elecom-pages/election/election';
import { Results } from './components/pages/elecom-pages/results/results';
import { Voters } from './components/pages/elecom-pages/voters/voters';
import { BallotCreator } from './components/pages/elecom-pages/ballot-creator/ballot-creator';

/* =========================
   ADMIN
========================= */

import { AdminDashboard } from './layouts/admin-portal/admin-dashboard/admin-dashboard';
import { AdminNotifications } from './layouts/admin-portal/admin-notifications/admin-notifications';
import { AdminSettings } from './layouts/admin-portal/admin-settings/admin-settings';
import { AdminElections } from './layouts/admin-portal/admin-elections/admin-elections';
import { AdminCandidates } from './layouts/admin-portal/admin-candidates/admin-candidates';
import { AdminAccounts } from './layouts/admin-portal/admin-accounts/admin-accounts';
import { AdminResults } from './layouts/admin-portal/admin-results/admin-results';

/* =========================
   STUDENT
========================= */

import { StudentDashboard } from './layouts/student-portal/student-dashboard/student-dashboard';
import { StudentNotif } from './layouts/student-portal/student-dashboard/student-notif/student-notif';

import { StudentElections } from './components/pages/student-pages/student-elections/student-elections';
import { StudentApply } from './components/pages/student-pages/student-apply/student-apply';
import { StudentBallot } from './components/pages/student-pages/student-ballot/student-ballot';
import { StudentDetails } from './layouts/student-portal/student-dashboard/student-details/student-details';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },

  {
    path: 'app',
    component: MainLayout,
    canActivate: [AuthGuard],

    children: [
      /* =========================
         ELECOM ROUTES
      ========================= */

      {
        path: 'elecom-dashboard',
        component: ElecomDashboard,
        canActivate: [RoleGuard],
        data: { role: 'elecom' },
      },
      {
        path: 'elecom-voters',
        component: Voters,
        canActivate: [RoleGuard],
        data: { role: 'elecom' },
      },
      {
        path: 'elecom-candidates',
        component: Candidates,
        canActivate: [RoleGuard],
        data: { role: 'elecom' },
      },
      {
        path: 'elecom-elections',
        component: Elections,
        canActivate: [RoleGuard],
        data: { role: 'elecom' },
      },
      {
        path: 'elecom-results',
        component: Results,
        canActivate: [RoleGuard],
        data: { role: 'elecom' },
      },
      {
        path: 'elecom-notifications',
        component: ElecomNotif,
        canActivate: [RoleGuard],
        data: { role: 'elecom' },
      },
      {
        path: 'elecom-settings',
        component: ElecomSettings,
        canActivate: [RoleGuard],
        data: { role: 'elecom' },
      },
      {
        path: 'elecom-ballot-creator',
        component: BallotCreator,
        canActivate: [RoleGuard],
        data: { role: 'elecom' },
      },

      /* =========================
         ADMIN ROUTES
      ========================= */

      {
        path: 'admin-dashboard',
        component: AdminDashboard,
        canActivate: [RoleGuard],
        data: { role: 'admin' },
      },
      {
        path: 'admin-elections',
        component: AdminElections,
        canActivate: [RoleGuard],
        data: { role: 'admin' },
      },
      {
        path: 'admin-candidates',
        component: AdminCandidates,
        canActivate: [RoleGuard],
        data: { role: 'admin' },
      },
      {
        path: 'admin-accounts',
        component: AdminAccounts,
        canActivate: [RoleGuard],
        data: { role: 'admin' },
      },
      {
        path: 'admin-results',
        component: AdminResults,
        canActivate: [RoleGuard],
        data: { role: 'admin' },
      },
      {
        path: 'admin-notifications',
        component: AdminNotifications,
        canActivate: [RoleGuard],
        data: { role: 'admin' },
      },
      {
        path: 'admin-settings',
        component: AdminSettings,
        canActivate: [RoleGuard],
        data: { role: 'admin' },
      },

      /* =========================
         STUDENT ROUTES
      ========================= */

      {
        path: 'student-dashboard',
        component: StudentDashboard,
        canActivate: [RoleGuard],
        data: { role: 'student' },
      },
      {
        path: 'student-elections',
        component: StudentElections,
        canActivate: [RoleGuard],
        data: { role: 'student' },
      },
      {
        path: 'student-apply',
        component: StudentApply,
        canActivate: [RoleGuard],
        data: { role: 'student' },
      },
      {
        path: 'student-ballot',
        component: StudentBallot,
        canActivate: [RoleGuard],
        data: { role: 'student' },
      },
      {
        path: 'student-ballot/:id',
        component: StudentBallot,
        canActivate: [RoleGuard],
        data: { role: 'student' },
      },
      {
        path: 'student-notifications',
        component: StudentNotif,
        canActivate: [RoleGuard],
        data: { role: 'student' },
      },
      // ── Permanent vote receipt — one per election ───────────────
      {
        path: 'student-details/:id',
        component: StudentDetails,
        canActivate: [RoleGuard],
        data: { role: 'student' },
      },
    ],
  },

  { path: '**', redirectTo: 'login' },
];