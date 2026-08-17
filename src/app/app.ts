import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';
import { WavyShellBridgeService } from './core/services/wavy-shell-bridge.service';
import { TopbarComponent } from './shared/components/topbar/topbar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly shellBridge = inject(WavyShellBridgeService);
  constructor(readonly authService: AuthService) {}

  ngOnInit(): void {
    this.authService.restaurerSession().subscribe();
  }
}
