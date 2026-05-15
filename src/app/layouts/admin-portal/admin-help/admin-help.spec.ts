import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminHelp } from './admin-help';

describe('AdminHelp', () => {
  let component: AdminHelp;
  let fixture: ComponentFixture<AdminHelp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminHelp]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminHelp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
