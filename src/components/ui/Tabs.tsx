import Link from 'next/link';

export interface TabItem {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
}

/** Abas baseadas em links (a aba ativa é definida pela URL). */
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="tab" aria-current={item.active ? 'page' : undefined}>
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export interface SegmentedItem {
  href: string;
  label: string;
  active: boolean;
}

export function Segmented({ items, label }: { items: SegmentedItem[]; label: string }) {
  return (
    <nav className="segmented" aria-label={label}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="segmented__item" aria-current={item.active ? 'true' : undefined} scroll={false}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
