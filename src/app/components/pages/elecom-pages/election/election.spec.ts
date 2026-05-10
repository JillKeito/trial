import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Elections } from './election';

describe('Elections', () => {
  let component: Elections;
  let fixture: ComponentFixture<Elections>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Elections]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Elections);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});