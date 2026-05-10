import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCandidates } from './admin-candidates';

describe('AdminCandidates', () => {
  let component: AdminCandidates;
  let fixture: ComponentFixture<AdminCandidates>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCandidates]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminCandidates);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
