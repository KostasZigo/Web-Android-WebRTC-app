import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  it('shows the video chat heading', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const heading: HTMLElement = fixture.nativeElement.querySelector('mat-toolbar');
    expect(heading.textContent).toContain('Video Chat');
  });
});
