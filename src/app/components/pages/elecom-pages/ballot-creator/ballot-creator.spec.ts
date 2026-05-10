import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BallotCreator } from './ballot-creator';

describe('BallotCreator', () => {
  let component: BallotCreator;
  let fixture: ComponentFixture<BallotCreator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BallotCreator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BallotCreator);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});