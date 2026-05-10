import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminElections } from './admin-elections';

describe('AdminElections', () => {
  let component: AdminElections;
  let fixture: ComponentFixture<AdminElections>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminElections]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminElections);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});