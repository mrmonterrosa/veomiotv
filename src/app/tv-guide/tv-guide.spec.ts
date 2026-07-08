import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TvGuide } from './tv-guide';

describe('TvGuide', () => {
  let component: TvGuide;
  let fixture: ComponentFixture<TvGuide>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TvGuide],
    }).compileComponents();

    fixture = TestBed.createComponent(TvGuide);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
