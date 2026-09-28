import {
  BarChart3,
  ClipboardList,
  Cog,
  LayoutDashboard,
  Package,
  Printer,
  Settings,
  ShoppingCart,
  Store,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { NavIconName } from '@/config/navigation';

export const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  customers: Users,
  orders: ClipboardList,
  services: Cog,
  products: Package,
  sales: ShoppingCart,
  store: Store,
  finance: Wallet,
  reports: BarChart3,
  print: Printer,
  users: UserCog,
  settings: Settings,
};
