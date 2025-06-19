
"use client";
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, LayoutDashboard, BookOpen, Users, CreditCard, UserX, Brain, Cog } from 'lucide-react';
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
  { href: '/intervention', label: 'AI Intervention', icon: Brain },
];

const settingsNavItem: NavItem = { href: '/settings', label: 'Settings', icon: Cog };

// Combine all items for mobile bottom navigation
const mobileNavItems: NavItem[] = [...mainNavItems, settingsNavItem];

export default function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Header: Logo and App Name (always visible) */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center">
          <Link href="/dashboard" className="flex items-center space-x-2 mr-6">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="font-headline text-2xl font-bold text-primary">{APP_NAME}</span>
          </Link>

          {/* Desktop Navigation Links (inside top header) */}
          <nav className="hidden md:flex items-center space-x-1 flex-grow">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Desktop Settings Icon (inside top header) */}
          <div className="hidden md:flex ml-auto items-center">
             <Link
                key={settingsNavItem.href}
                href={settingsNavItem.href}
                className={cn(
                  "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === settingsNavItem.href
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
                aria-current={pathname === settingsNavItem.href ? 'page' : undefined}
              >
                <settingsNavItem.icon className="h-5 w-5" />
                <span className="sr-only">{settingsNavItem.label}</span>
              </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container max-w-screen-2xl py-8 pb-24 md:pb-8"> {/* Adjusted padding-bottom for mobile */}
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-full max-w-screen-2xl items-center justify-around">
          {mobileNavItems.map((item) => (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 flex-1 p-1 h-full rounded-md text-xs font-medium transition-colors",
                pathname === item.href
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5",
                "focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
              )}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
      
      <footer className="py-6 md:px-8 md:py-0 bg-background border-t border-border/40">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-20 md:flex-row">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
