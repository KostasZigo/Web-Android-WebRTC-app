import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { AppModule } from './app.module';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule]
    }).compileComponents();
  });

  it('shows the video chat heading', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const heading: HTMLElement = fixture.nativeElement.querySelector('mat-toolbar');
    expect(heading.textContent).toContain('Video Chat');
  });

  it('keeps the call controls and both video views on the page', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const page: HTMLElement = fixture.nativeElement;

    expect(page.querySelector('main')).not.toBeNull();
    expect(page.querySelectorAll('video')).toHaveLength(2);
    expect(Array.from(page.querySelectorAll('button'), button => button.textContent?.trim())).toEqual([
      'Start', 'Stop', 'Call', 'Hangup'
    ]);
  });
});
