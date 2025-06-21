
'use client';
import type { ReactNode } from 'react';
import { usePathname, redirect } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import MainLayout from '@/components/layout/MainLayout';
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from 'lucide-react';

export default function AuthWrapper({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useAppContext();
    const pathname = usePathname();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated && pathname !== '/login') {
        redirect('/login');
    }

    if (isAuthenticated && pathname === '/login') {
        redirect('/dashboard');
    }

    if (pathname === '/login') {
        return (
            <>
                {children}
                <Toaster /> 
            </>
        );
    }

    // Must be authenticated to reach here
    return (
        <>
            <MainLayout>{children}</MainLayout>
            <Toaster />
        </>
    );
}
