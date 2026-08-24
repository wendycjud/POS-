import { Component, inject, OnInit, OnDestroy, computed, signal, HostListener, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { LayoutService } from '../../core/services/layout.service';
import { BarcodeService } from '../../core/services/barcode.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductService, CategoryService, SalespersonService } from '../../core/services/product.service';
import { HeldSaleService } from '../../core/services/sale.service';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
import { Product, Category, Salesperson } from '../../core/models/product.model';
import { CartItem } from '../../core/models/sale.model';
import { CheckoutDialogComponent } from './components/checkout-dialog/checkout-dialog.component';
import { ReceiptDialogComponent } from './components/receipt-dialog/receipt-dialog.component';
import { HoldSaleDialogComponent } from './components/hold-sale-dialog/hold-sale-dialog.component';
import { HeldSalesDialogComponent } from './components/held-sales-dialog/held-sales-dialog.component';
import { ReturnDialogComponent } from './components/return-dialog/return-dialog.component';
import { OpenSessionDialogComponent } from './components/open-session-dialog/open-session-dialog.component';
import { CashDialogComponent } from './components/cash-dialog/cash-dialog.component';
import { QuickSaleDialogComponent } from './components/quick-sale-dialog/quick-sale-dialog.component';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatBadgeModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    QuickSaleDialogComponent
  ],
  templateUrl: './pos.component.html'
})
export class PosComponent implements OnInit, AfterViewInit, OnDestroy {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private salespersonService = inject(SalespersonService);
  layout = inject(LayoutService);
  private barcodeService = inject(BarcodeService);
  private heldSaleService = inject(HeldSaleService);
  private sessionService = inject(SessionService);
  auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  session = this.sessionService.currentSession;

  products: Product[] = [];
  categories: Category[] = [];
  salespersons: Salesperson[] = [];
  cart = signal<CartItem[]>([]);
  billDiscountPct = signal(0);
  discChips = [5, 10, 15, 20];
  searchQuery = '';
  selectedCategory: number | null = null;
  selectedSalespersonId: number | null = null;
  saleType: 'RETAIL' | 'WHOLESALE' = 'RETAIL';
  loadingProducts = false;
  heldCount = 0;
  mobileCartOpen = false;

  private scanFirstCharTime = 0;
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  subtotal = computed(() => this.cart().reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0));
  totalDiscount = computed(() => this.cart().reduce((sum, i) => sum + i.itemDiscount, 0));
  itemsTotal = computed(() => this.cart().reduce((sum, i) => sum + i.subtotal, 0));
  billDiscountAmt = computed(() => this.itemsTotal() * this.billDiscountPct() / 100);
  cartTotal = computed(() => this.itemsTotal() - this.billDiscountAmt());

  ngOnInit() {
    this.searchSubject.pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(() => this.loadProducts());

    this.loadProducts();
    this.categoryService.getAll().subscribe(cats => this.categories = cats);
    this.salespersonService.getAll().subscribe(sps => {
      this.salespersons = sps;
      if (sps.length) this.selectedSalespersonId = sps[0].id;
    });
    this.sessionService.loadCurrent().subscribe(s => {
      if (!s && !this.auth.isOwner()) {
        setTimeout(() => this.openSession(), 300);
      } else {
        this.refreshHeldCount();
      }
    });
  }

  private isMobile = window.matchMedia('(max-width: 767px)').matches ||
                     ('ontouchstart' in window);

  ngAfterViewInit() {
    if (!this.isMobile) this.focusSearch();
  }

  focusSearch() {
    if (this.isMobile) return;
    setTimeout(() => this.searchInputRef?.nativeElement?.focus(), 50);
  }

  onSearchBlur() {
    if (this.isMobile) return;
    if (!this.dialog.openDialogs.length) {
      setTimeout(() => {
        const active = document.activeElement;
        const tag = active?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        this.searchInputRef?.nativeElement?.focus();
      }, 150);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.isMobile) return;
    if (e.key === 'F2') { e.preventDefault(); this.openCheckout(); }
    if (e.key === 'F3') { e.preventDefault(); this.holdSale(); }
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); this.focusSearch(); }
    if (e.key === 'Escape') { this.searchQuery = ''; this.onSearch(); this.focusSearch(); }
  }

  onSearchInput() {
    if (!this.scanFirstCharTime) this.scanFirstCharTime = Date.now();
    if (this.searchQuery.length === 0) {
      this.scanFirstCharTime = 0;
      this.loadProducts(); // clear immediately, no debounce needed
    } else {
      this.searchSubject.next(this.searchQuery); // debounced API call
    }
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  onSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const elapsed = this.scanFirstCharTime ? Date.now() - this.scanFirstCharTime : Infinity;
      const value = this.searchQuery.trim();
      this.scanFirstCharTime = 0;

      if (value && elapsed < 100 && this.barcodeService.looksLikeBarcode(value)) {
        this.lookupByBarcode(value);
      } else if (value) {
        this.onSearch();
      }
    } else {
      if (!this.scanFirstCharTime) {
        this.scanFirstCharTime = Date.now();
      }
    }
  }

  private lookupByBarcode(barcode: string) {
    this.productService.getByBarcode(barcode).subscribe({
      next: product => {
        this.addToCart(product);
        this.searchQuery = '';
        this.scanFirstCharTime = 0;
        this.focusSearch();
      },
      error: () => {
        this.snack.open(`Product not found: ${barcode}`, 'OK', { duration: 3000 });
        this.searchQuery = '';
        this.scanFirstCharTime = 0;
        this.focusSearch();
      }
    });
  }

  loadProducts() {
    this.loadingProducts = true;
    this.productService.getAll(this.searchQuery || undefined, this.selectedCategory || undefined).subscribe({
      next: products => { this.products = products; this.loadingProducts = false; },
      error: () => this.loadingProducts = false
    });
  }

  onSearch() { this.selectedCategory = null; this.loadProducts(); }
  selectCategory(id: number | null) { this.selectedCategory = id; this.searchQuery = ''; this.loadProducts(); }

  addToCart(product: Product) {
    if (!this.session()) {
      this.openSession();
      return;
    }
    if (product.stockQuantity <= 0) {
      this.snack.open(`${product.name} is out of stock`, '', { duration: 2000 });
      return;
    }
    const items = this.cart();
    const existingIdx = items.findIndex(i => i.productId === product.id);
    if (existingIdx >= 0) {
      const current = items[existingIdx];
      if (current.quantity >= product.stockQuantity) {
        this.snack.open(`Only ${product.stockQuantity} in stock`, '', { duration: 2000 });
        return;
      }
      this.cart.update(arr => {
        const next = [...arr];
        const item = { ...next[existingIdx], quantity: next[existingIdx].quantity + 1 };
        const gross = item.unitPrice * item.quantity;
        item.subtotal = gross - item.itemDiscount;
        next[existingIdx] = item;
        return next;
      });
    } else {
      const price = this.saleType === 'WHOLESALE' && product.wholesalePrice ? product.wholesalePrice : product.retailPrice;
      this.cart.update(arr => [...arr, {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        imageUrl: product.imageUrl,
        quantity: 1,
        unitPrice: price,
        priceType: this.saleType,
        itemDiscount: 0,
        itemDiscountPct: 0,
        subtotal: price,
        stockQuantity: product.stockQuantity,
        unit: product.unit,
        retailPrice: product.retailPrice,
        wholesalePrice: product.wholesalePrice,
        minWholesaleQty: product.minWholesaleQty,
        costPrice: product.costPrice
      }]);
      if (product.stockQuantity <= product.minStockAlert) {
        this.snack.open(`Low stock: ${product.name} (${product.stockQuantity} left)`, '', { duration: 3000 });
      }
    }
  }

  removeFromCart(i: number) { this.cart.update(arr => arr.filter((_, idx) => idx !== i)); }
  clearCart() { this.cart.set([]); this.billDiscountPct.set(0); }

  changeQty(i: number, delta: number) {
    this.cart.update(arr => {
      const next = [...arr];
      const cur = next[i];
      const newQty = Math.max(0.5, cur.quantity + delta);
      if (delta > 0 && newQty > cur.stockQuantity) {
        this.snack.open(`Only ${cur.stockQuantity} in stock`, '', { duration: 2000 });
        return arr;
      }
      const item = { ...cur, quantity: newQty };
      const gross = item.unitPrice * item.quantity;
      item.itemDiscount = Math.min(item.itemDiscount, gross);
      item.subtotal = gross - item.itemDiscount;
      next[i] = item;
      return next;
    });
  }

  onQtyChange(i: number) {
    this.cart.update(arr => {
      const next = [...arr];
      const item = { ...next[i] };
      if (item.quantity <= 0) item.quantity = 1;
      if (item.quantity > item.stockQuantity) item.quantity = item.stockQuantity;
      const gross = item.unitPrice * item.quantity;
      item.itemDiscount = Math.min(item.itemDiscount, gross);
      item.subtotal = gross - item.itemDiscount;
      next[i] = item;
      return next;
    });
  }

  recalcItem(i: number) {
    this.cart.update(arr => {
      const next = [...arr];
      const item = { ...next[i] };
      const gross = item.unitPrice * item.quantity;
      item.itemDiscount = Math.min(item.itemDiscount, gross);
      item.subtotal = Math.max(0, gross - item.itemDiscount);
      next[i] = item;
      return next;
    });
  }

  setItemDiscount(i: number, amount: number) {
    this.cart.update(arr => {
      const next = [...arr];
      const item = { ...next[i] };
      const gross = item.unitPrice * item.quantity;
      item.itemDiscount = Math.min(Math.max(0, +amount || 0), gross);
      item.itemDiscountPct = gross > 0 ? (item.itemDiscount / gross) * 100 : 0;
      item.subtotal = gross - item.itemDiscount;
      next[i] = item;
      return next;
    });
  }

  setSaleType(type: 'RETAIL' | 'WHOLESALE') {
    this.saleType = type;
    this.cart.update(arr => arr.map(item => {
      const p = this.products.find(p => p.id === item.productId);
      if (!p) return item;
      const price = type === 'WHOLESALE' && p.wholesalePrice ? p.wholesalePrice : p.retailPrice;
      const gross = price * item.quantity;
      const disc = Math.min(item.itemDiscount, gross);
      return { ...item, unitPrice: price, priceType: type, itemDiscount: disc, subtotal: gross - disc };
    }));
  }

  openCheckout() {
    if (!this.cart().length || !this.session()) return;
    const ref = this.dialog.open(CheckoutDialogComponent, {
      width: '480px',
      data: {
        cart: this.cart(),
        subtotal: this.subtotal(),
        totalDiscount: this.totalDiscount(),
        billDiscount: this.billDiscountAmt(),
        cartTotal: this.cartTotal(),
        sessionId: this.session()!.id,
        salespersonId: this.selectedSalespersonId,
        salespersons: this.salespersons,
        saleType: this.saleType
      }
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        const soldItems = this.cart();
        this.dialog.open(ReceiptDialogComponent, {
          width: '420px',
          data: result
        }).afterClosed().subscribe(() => {
          this.products = this.products.map(p => {
            const sold = soldItems.find(i => i.productId === p.id);
            return sold ? { ...p, stockQuantity: Math.max(0, p.stockQuantity - sold.quantity) } : p;
          });
          this.clearCart();
          this.refreshHeldCount();
        });
      }
    });
  }

  holdSale() {
    if (!this.cart().length || !this.session()) return;
    const ref = this.dialog.open(HoldSaleDialogComponent, {
      width: '380px',
      data: {
        cart: this.cart(),
        sessionId: this.session()!.id,
        salespersonId: this.selectedSalespersonId,
        saleType: this.saleType
      }
    });
    ref.afterClosed().subscribe(held => {
      if (held) {
        this.clearCart();
        this.heldCount++;
        this.snack.open('Sale held successfully', 'OK', { duration: 2000 });
      }
    });
  }

  openHeldSales() {
    if (!this.session()) return;
    const ref = this.dialog.open(HeldSalesDialogComponent, {
      width: '480px',
      data: { sessionId: this.session()!.id }
    });
    ref.afterClosed().subscribe(resumed => {
      if (resumed) {
        const items = JSON.parse(resumed.items) as CartItem[];
        this.cart.set(items);
        this.saleType = resumed.saleType;
        this.heldSaleService.delete(resumed.id).subscribe(() => this.refreshHeldCount());
      }
    });
  }

  openReturn() {
    if (!this.session()) return;
    this.dialog.open(ReturnDialogComponent, {
      width: '640px',
      data: { sessionId: this.session()!.id, salespersonId: this.selectedSalespersonId }
    }).afterClosed().subscribe(result => {
      if (result) this.snack.open('Return processed successfully', '', { duration: 2500 });
    });
  }

  openQuickSale() {
    this.dialog.open(QuickSaleDialogComponent, { width: '560px' })
      .afterClosed().subscribe(result => {
        if (result === 'saved') {
          this.snack.open('Quick sale recorded', '', { duration: 2000 });
          this.loadProducts();
        }
      });
  }

  openSession() {
    const ref = this.dialog.open(OpenSessionDialogComponent, { width: '400px', disableClose: true });
    ref.afterClosed().subscribe(opened => {
      if (opened) this.snack.open('Session opened!', 'OK', { duration: 2000 });
    });
  }

  openCashIn() {
    if (!this.session()) return;
    this.dialog.open(CashDialogComponent, {
      width: '400px',
      data: { type: 'IN', sessionId: this.session()!.id }
    }).afterClosed().subscribe(done => {
      if (done) this.snack.open('Cash In recorded', '', { duration: 2000 });
    });
  }

  openCashOut() {
    if (!this.session()) return;
    this.dialog.open(CashDialogComponent, {
      width: '400px',
      data: { type: 'OUT', sessionId: this.session()!.id }
    }).afterClosed().subscribe(done => {
      if (done) this.snack.open('Cash Out recorded', '', { duration: 2000 });
    });
  }

  private refreshHeldCount() {
    const s = this.session();
    if (s) {
      this.heldSaleService.getBySession(s.id).subscribe(held => this.heldCount = held.length);
    }
  }
}
