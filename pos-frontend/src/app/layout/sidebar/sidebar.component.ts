import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { SessionService } from '../../core/services/session.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  ownerOnly?: boolean;
  roles?: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {

  auth = inject(AuthService);
  layout = inject(LayoutService);

  private session = inject(SessionService);
  private router = inject(Router);

  moreOpen = false;

  private navItems: NavItem[] = [

  // OWNER + CASHIER
  {
    label: 'Punto de Venta',
    icon: 'point_of_sale',
    route: '/pos',
    roles: ['OWNER', 'CASHIER']
  },
  {
    label: 'Productos',
    icon: 'inventory_2',
    route: '/products',
    roles: ['OWNER', 'CASHIER', 'SALESPERSON']
  },
  {
    label: 'Clientes',
    icon: 'people',
    route: '/customers',
    roles: ['OWNER', 'CASHIER']
  },
  {
    label: 'Proveedores',
    icon: 'local_shipping',
    route: '/suppliers',
    roles: ['OWNER']
  },
  {
    label: 'Historial de Ventas',
    icon: 'receipt_long',
    route: '/sales',
    roles: ['OWNER', 'CASHIER']
  },
  {
    label: 'Créditos',
    icon: 'account_balance',
    route: '/credits',
    roles: ['OWNER', 'CASHIER']
  },
  {
    label: 'Devoluciones',
    icon: 'assignment_return',
    route: '/returns',
    roles: ['OWNER', 'CASHIER']
  },
  {
    label: 'Garantías',
    icon: 'verified_user',
    route: '/warranty',
    roles: ['OWNER', 'CASHIER']
  },
  {
    label: 'Cerrar Caja',
    icon: 'lock_clock',
    route: '/close-till',
    roles: ['OWNER', 'CASHIER']
  },
  {
    label: 'Conciliación de Caja',
    icon: 'account_balance_wallet',
    route: '/cash-reconciliation',
    roles: ['OWNER']
  },
  {
    label: 'Reportes',
    icon: 'bar_chart',
    route: '/reports',
    roles: ['OWNER']
  },
  {
    label: 'Gastos',
    icon: 'account_balance_wallet',
    route: '/expenses',
    roles: ['OWNER', 'CASHIER']
  },
  {
    label: 'Suministros',
    icon: 'shopping_bag',
    route: '/shop-supplies',
    roles: ['OWNER', 'CASHIER']
  },

  // SALESPERSON
  {
    label: 'Lista de Necesidades',
    icon: 'checklist',
    route: '/needs',
    roles: ['OWNER', 'SALESPERSON']
  },

  // STORE_PERSON
  {
    label: 'Necesidades de Tienda',
    icon: 'warehouse',
    route: '/store-needs',
    roles: ['OWNER', 'STORE_PERSON']
  },

  // OWNER
  {
    label: 'Configuración',
    icon: 'settings',
    route: '/settings',
    roles: ['OWNER']
  }
];

  private get role(): string {
    return this.auth.currentUser()?.role ?? '';
  }

  private isMobileMain(route: string): boolean {
    if (this.auth.isSalesperson()) {
      return ['/needs', '/products'].includes(route);
    }

    if (this.auth.isStorePerson()) {
      return ['/store-needs'].includes(route);
    }

    return [
      '/pos',
      '/sales',
      '/reports',
     
    ].includes(route);
  }

  private isVisible(item: NavItem): boolean {
    if (!item.roles) {
      return true;
    }

    return item.roles.includes(this.role);
  }

  get visibleItems(): NavItem[] {
    return this.navItems.filter(item => this.isVisible(item));
  }

  get mobileNavItems(): NavItem[] {
    return this.navItems.filter(
      item =>
        this.isVisible(item) &&
        this.isMobileMain(item.route)
    );
  }

  get moreItems(): NavItem[] {
    return this.navItems.filter(
      item =>
        this.isVisible(item) &&
        !this.isMobileMain(item.route)
    );
  }

  get roleLabel(): string {
    switch (this.role) {
      case 'OWNER':
        return 'Administrator';

      case 'CASHIER':
        return 'Cashier';

      case 'SALESPERSON':
        return 'Salesperson';

      case 'STORE_PERSON':
        return 'Store Person';

      default:
        return this.role;
    }
  }

  handleLogout(): void {
    if (
      this.auth.isCashier() &&
      this.session.currentSession()
    ) {
      this.router.navigate(['/close-till']);
      return;
    }

    this.auth.logout();
  }
}