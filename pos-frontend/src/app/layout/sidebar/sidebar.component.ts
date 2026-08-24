import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { SessionService } from '../../core/services/session.service';
import { CommonModule } from '@angular/common';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  ownerOnly?: boolean;
  roles?: string[]; // if set, only shown to these roles (OWNER always sees everything)
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  template: `
    <nav class="sidebar" [class.collapsed]="layout.collapsed()">
      <div class="sidebar-logo">
        <img src="assets/logo.png" alt="Ghanim Logo" class="logo-img" />
        @if (!layout.collapsed()) {
          <div class="logo-text">
            <span class="brand">GHANIM</span>
            <span class="sub">ENTERPRISES</span>
          </div>
        }
      </div>

      <!-- Desktop nav list -->
      <ul class="nav-list desktop-nav">
        @for (item of visibleItems; track item.route) {
          <li>
            <a [routerLink]="item.route" routerLinkActive="active" class="nav-item"
               [matTooltip]="layout.collapsed() ? item.label : ''" matTooltipPosition="right">
              <mat-icon>{{ item.icon }}</mat-icon>
              @if (!layout.collapsed()) {
                <span>{{ item.label }}</span>
              }
            </a>
          </li>
        }
      </ul>

      <!-- Mobile bottom nav (pinned items) -->
      <ul class="nav-list mobile-nav">
        @for (item of mobileNavItems; track item.route) {
          <li>
            <a [routerLink]="item.route" routerLinkActive="active" class="nav-item">
              <mat-icon>{{ item.icon }}</mat-icon>
              <span>{{ item.label }}</span>
            </a>
          </li>
        }
        <!-- Logout directly for limited roles, More drawer for full roles -->
        @if (auth.isSalesperson() || auth.isStorePerson()) {
          <li>
            <button class="nav-item logout-mobile-btn" (click)="handleLogout()">
              <mat-icon>logout</mat-icon>
              <span>Logout</span>
            </button>
          </li>
        } @else {
          <li>
            <button class="nav-item more-btn" [class.more-open]="moreOpen" (click)="moreOpen = !moreOpen">
              <mat-icon>{{ moreOpen ? 'close' : 'menu' }}</mat-icon>
              <span>More</span>
            </button>
          </li>
        }
      </ul>

      <div class="sidebar-footer">
        @if (!layout.collapsed()) {
          <div class="user-info">
            <div class="user-avatar">{{ auth.currentUser()?.name?.charAt(0) }}</div>
            <div class="user-details">
              <div class="user-name">{{ auth.currentUser()?.name }}</div>
              <div class="user-role">{{ roleLabel }}</div>
            </div>
          </div>
          <button class="logout-btn" (click)="handleLogout()">
            <mat-icon>logout</mat-icon> Logout
          </button>
        } @else {
          <div class="user-avatar centered" [matTooltip]="auth.currentUser()?.name || ''" matTooltipPosition="right">
            {{ auth.currentUser()?.name?.charAt(0) }}
          </div>
          <button class="logout-btn-icon" (click)="handleLogout()" matTooltip="Logout" matTooltipPosition="right">
            <mat-icon>logout</mat-icon>
          </button>
        }
      </div>
    </nav>

    <!-- Mobile more drawer overlay -->
    @if (moreOpen) {
      <div class="more-overlay" (click)="moreOpen = false">
        <div class="more-drawer" (click)="$event.stopPropagation()">
          <div class="more-header">
            <div class="more-user">
              <div class="more-avatar">{{ auth.currentUser()?.name?.charAt(0) }}</div>
              <div>
                <div class="more-name">{{ auth.currentUser()?.name }}</div>
                <div class="more-role">{{ roleLabel }}</div>
              </div>
            </div>
          </div>
          <ul class="more-nav-list">
            @for (item of moreItems; track item.route) {
              <li>
                <a [routerLink]="item.route" routerLinkActive="active" class="more-nav-item"
                   (click)="moreOpen = false">
                  <mat-icon>{{ item.icon }}</mat-icon>
                  <span>{{ item.label }}</span>
                </a>
              </li>
            }
          </ul>
          <div class="more-footer">
            <button class="more-logout-btn" (click)="handleLogout()">
              <mat-icon>logout</mat-icon> Logout
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-shrink: 0;
    }
    .sidebar {
      width: 195px;
      min-width: 195px;
      background: #1b3050;
      color: #fff;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      transition: width 0.2s ease, min-width 0.2s ease;
    }
    .sidebar.collapsed {
      width: 56px;
      min-width: 56px;
    }

    .mobile-nav { display: none; }

    @media (max-width: 767px) {
      :host { width: 100%; position: fixed; bottom: 0; left: 0; z-index: 100; height: auto; }
      .sidebar {
        width: 100% !important; min-width: 100% !important;
        height: 60px; flex-direction: row;
        overflow: visible;
        border-top: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 -2px 12px rgba(0,0,0,0.18);
      }
      .sidebar-logo { display: none !important; }
      .desktop-nav { display: none !important; }
      .sidebar-footer { display: none !important; }

      .mobile-nav {
        display: flex; flex-direction: row;
        padding: 0; flex: 1; margin: 0;
        overflow-x: auto; overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .mobile-nav::-webkit-scrollbar { display: none; }
      li { flex: 1; min-width: 56px; }
      .nav-item, .more-btn {
        flex-direction: column; gap: 2px;
        padding: 6px 4px;
        font-size: 9px; font-weight: 500;
        border-left: none !important; border-bottom: 3px solid transparent;
        border-radius: 0 !important; margin: 0 !important;
        white-space: nowrap; justify-content: center; height: 60px;
        width: 100%; background: transparent; border: none; cursor: pointer;
        color: rgba(255,255,255,0.65); font-family: inherit; display: flex; align-items: center;
        text-decoration: none;
      }
      .nav-item.active {
        border-bottom-color: #c9a84c !important;
        border-left: none !important; background: rgba(255,255,255,0.08);
        color: #fff;
      }
      .more-btn.more-open { background: rgba(255,255,255,0.08); color: #fff; }
      .logout-mobile-btn { color: rgba(255,120,120,0.8) !important; }
      .logout-mobile-btn:hover { color: #ff8080 !important; background: rgba(255,80,80,0.1); }
      .nav-item mat-icon, .more-btn mat-icon { font-size: 21px; width: 21px; height: 21px; }
    }

    /* More overlay (mobile only) */
    .more-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 200;
      display: flex; align-items: flex-end;
    }
    .more-drawer {
      width: 100%; background: #fff; border-radius: 20px 20px 0 0;
      padding-bottom: 60px; max-height: 80vh; overflow-y: auto;
    }
    .more-header { padding: 16px 20px; border-bottom: 1px solid #eef0f4; }
    .more-user { display: flex; align-items: center; gap: 12px; }
    .more-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: #1b3050; color: #c9a84c;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 700; flex-shrink: 0;
    }
    .more-name { font-size: 14px; font-weight: 700; color: #1b3050; }
    .more-role { font-size: 12px; color: #6b7280; }
    .more-nav-list { list-style: none; padding: 8px 0; margin: 0; }
    .more-nav-item {
      display: flex; align-items: center; gap: 14px;
      padding: 13px 20px; text-decoration: none;
      color: #374151; font-size: 14px; font-weight: 500;
      transition: background 0.1s;
      mat-icon { color: #6b7280; font-size: 20px; width: 20px; height: 20px; }
      &:hover, &.active { background: #f4f6f9; color: #1b3050; mat-icon { color: #1b3050; } }
      &.active { font-weight: 700; }
    }
    .more-footer { padding: 12px 20px; border-top: 1px solid #eef0f4; }
    .more-logout-btn {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 0; background: none; border: none;
      color: #c62828; font-size: 14px; font-weight: 500; cursor: pointer;
      font-family: inherit;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
      min-height: 56px;
    }
    .logo-img {
      width: 38px; height: 38px;
      object-fit: contain; flex-shrink: 0;
      border-radius: 6px;
    }
    .logo-text { display: flex; flex-direction: column; overflow: hidden; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #c9a84c; white-space: nowrap; }
    .sub { font-size: 8px; color: rgba(255,255,255,0.4); letter-spacing: 0.5px; white-space: nowrap; }

    .nav-list { list-style: none; padding: 4px 0; flex: 1; overflow-y: auto; overflow-x: hidden; margin: 0; min-height: 0; }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 7px 10px 7px 14px;
      color: rgba(255,255,255,0.65);
      text-decoration: none;
      font-size: 12px;
      transition: all 0.15s;
      border-left: 3px solid transparent;
      white-space: nowrap;
    }
    .collapsed .nav-item { padding: 10px; justify-content: center; }
    .nav-item:hover { background: rgba(255,255,255,0.05); color: #fff; }
    .nav-item.active {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border-left-color: #c9a84c;
    }
    .collapsed .nav-item.active { border-left-color: transparent; border-left: none; background: rgba(201,168,76,0.2); border-radius: 6px; margin: 0 4px; }
    .nav-item mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }

    .sidebar-footer {
      padding: 7px 10px;
      border-top: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
      margin-top: 4px;
    }
    .user-info {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 5px;
    }
    .user-avatar {
      width: 26px; height: 26px; border-radius: 50%;
      background: #c9a84c; color: #1b3050;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; flex-shrink: 0;
    }
    .user-avatar.centered { margin: 0 auto 6px; cursor: default; }
    .user-details { display: flex; flex-direction: column; min-width: 0; }
    .user-name { font-size: 11px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { font-size: 9.5px; color: rgba(255,255,255,0.4); }
    .logout-btn {
      display: flex; align-items: center; gap: 6px;
      width: 100%; padding: 4px 8px;
      background: transparent; border: none; border-radius: 5px;
      color: rgba(255,255,255,0.55); cursor: pointer; font-size: 11px;
      transition: all 0.15s; font-family: inherit;
    }
    .logout-btn mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .logout-btn:hover { background: rgba(255,255,255,0.07); color: #fff; }
    .logout-btn-icon {
      display: flex; align-items: center; justify-content: center;
      width: 100%; padding: 6px;
      background: transparent; border: none; border-radius: 5px;
      color: rgba(255,255,255,0.55); cursor: pointer;
      transition: all 0.15s;
    }
    .logout-btn-icon:hover { background: rgba(255,255,255,0.07); color: #fff; }
    .logout-btn-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `]
})
export class SidebarComponent {
  auth = inject(AuthService);
  layout = inject(LayoutService);
  private session = inject(SessionService);
  private router = inject(Router);

  moreOpen = false;

  private navItems: NavItem[] = [
    // OWNER + CASHIER routes
    { label: 'POS',          icon: 'point_of_sale',         route: '/pos',                roles: ['OWNER', 'CASHIER'] },
    { label: 'Productos',     icon: 'inventory_2',            route: '/products',           roles: ['OWNER', 'CASHIER', 'SALESPERSON'] },
    { label: 'Clientes',    icon: 'people',                 route: '/customers',          roles: ['OWNER', 'CASHIER'] },
    { label: 'Proveedores',    icon: 'local_shipping',         route: '/suppliers',          roles: ['OWNER'] },
    { label: 'Historial de Ventas',icon: 'receipt_long',           route: '/sales',              roles: ['OWNER', 'CASHIER'] },
    { label: 'Créditos',      icon: 'account_balance',        route: '/credits',            roles: ['OWNER', 'CASHIER'] },
    { label: 'Devoluciones',      icon: 'assignment_return',      route: '/returns',            roles: ['OWNER', 'CASHIER'] },
    { label: 'Garantías',     icon: 'verified_user',          route: '/warranty',           roles: ['OWNER', 'CASHIER'] },
    { label: 'Close Till',   icon: 'lock_clock',             route: '/close-till',         roles: ['OWNER', 'CASHIER'] },
    { label: 'Cash Recon',   icon: 'account_balance_wallet', route: '/cash-reconciliation',roles: ['OWNER'] },
    { label: 'Reportes',      icon: 'bar_chart',              route: '/reports',            roles: ['OWNER'] },
    { label: 'Expenses',     icon: 'account_balance_wallet', route: '/expenses',           roles: ['OWNER', 'CASHIER'] },
    { label: 'Shop Supplies',icon: 'shopping_bag',           route: '/shop-supplies',      roles: ['OWNER', 'CASHIER'] },
    // SALESPERSON route
    { label: 'Needs List',   icon: 'checklist',              route: '/needs',              roles: ['OWNER', 'SALESPERSON'] },
    // STORE_PERSON route
    { label: 'Store Needs',  icon: 'warehouse',              route: '/store-needs',        roles: ['OWNER', 'STORE_PERSON'] },
    { label: 'Settings',     icon: 'settings',               route: '/settings',           roles: ['OWNER'] },
  ];

  private get role(): string { return this.auth.currentUser()?.role ?? ''; }

  private isMobileMain(route: string): boolean {
    if (this.auth.isSalesperson()) return ['/needs', '/products'].includes(route);
    if (this.auth.isStorePerson()) return ['/store-needs'].includes(route);
    return ['/pos', '/sales', '/reports', '/expenses', '/needs'].includes(route);
  }

  private isVisible(item: NavItem): boolean {
    if (!item.roles) return true;
    return item.roles.includes(this.role);
  }

  get visibleItems(): NavItem[] {
    return this.navItems.filter(i => this.isVisible(i));
  }

  get mobileNavItems(): NavItem[] {
    return this.navItems.filter(i => this.isVisible(i) && this.isMobileMain(i.route));
  }

  get moreItems(): NavItem[] {
    return this.navItems.filter(i => this.isVisible(i) && !this.isMobileMain(i.route));
  }

  get roleLabel(): string {
    switch (this.role) {
      case 'OWNER': return 'Administrator';
      case 'CASHIER': return 'Cashier';
      case 'SALESPERSON': return 'Salesperson';
      case 'STORE_PERSON': return 'Store Person';
      default: return this.role;
    }
  }

  handleLogout() {
    if (this.auth.isCashier() && this.session.currentSession()) {
      this.router.navigate(['/close-till']);
      return;
    }
    this.auth.logout();
  }
}


