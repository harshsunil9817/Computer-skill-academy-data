
"use client";
import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Users, CreditCard, UserX, Brain, Cog } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/archived-students', label: 'Archived', icon: UserX },
];

const settingsNavItem: NavItem = { href: '/settings', label: 'Settings', icon: Cog };

// Combine all items for bottom navigation
const bottomNavItems: NavItem[] = [...mainNavItems, settingsNavItem];

export default function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-20 max-w-screen-2xl items-center justify-between px-4">
          {/* Left Corner: NEILIT Logo */}
          <div className="flex flex-col items-start justify-center" style={{ minWidth: '150px' }}>
            <Link href="/" aria-label="Home">
              <Image
                src="https://drive.google.com/uc?export=view&id=1vHRrnuM9NfkaFIgdQihUoKP4z5b1uUu6"
                alt="Academy Logo"
                width={100}
                height={40}
                priority
              />
            </Link>
          </div>

          {/* Center: Academy Name & Powered by */}
          <div className="flex-1 text-center px-2 flex flex-col items-center justify-center">
            <h1 className="font-headline text-lg sm:text-xl lg:text-2xl font-bold text-primary truncate">
              Computer Skill Academy Nagra Ballia
            </h1>
            <p className="text-base font-medium text-foreground mt-1">
              Powered by National Institute of Electronics & Information Technology (NEILIT)
            </p>
          </div>

          {/* Right Corner: Spacer to balance logo */}
          <div style={{ minWidth: '150px' }} className="hidden sm:block">
            {/* Empty or potentially a small non-navigational element */}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container max-w-screen-2xl py-8 pb-24"> {/* Ensure padding-bottom for bottom nav */}
        {children}
      </main>

      {/* Bottom Navigation (always visible) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-full max-w-screen-2xl items-center justify-around px-0 sm:px-4">
          {bottomNavItems.map((item) => (
            <Link
              key={`bottom-nav-${item.href}`}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 flex-1 p-1 h-full rounded-md text-xs font-medium transition-colors",
                pathname === item.href
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5",
                "focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
              )}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate max-w-[calc(100vw/7-0.5rem)] sm:max-w-none">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <footer className="py-6 md:px-8 bg-background border-t border-border/40 text-center">
        <div className="container flex flex-col items-center justify-center gap-2">
          <p className="text-balance text-sm leading-loose text-muted-foreground">
            &copy; {new Date().getFullYear()} {APP_NAME}.
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by National Institute of Electronics & Information Technology (NEILIT). All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
