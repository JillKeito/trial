import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminAccounts } from './admin-accounts';

describe('AdminAccounts', () => {
  let component: AdminAccounts;
  let fixture: ComponentFixture<AdminAccounts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAccounts]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminAccounts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});