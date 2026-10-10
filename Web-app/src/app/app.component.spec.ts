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
});
