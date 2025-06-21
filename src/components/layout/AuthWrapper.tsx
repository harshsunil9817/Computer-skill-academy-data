
'use client';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import MainLayout from '@/components/layout/MainLayout';
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from 'lucide-react';
import React, { useEffect } from 'react';

export default function AuthWrapper({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading } = useAppContext();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated && pathname !== '/login') {
                router.push('/login');
            }
            if (isAuthenticated && pathname === '/login') {
                router.push('/dashboard');
            }
        }
    }, [isLoading, isAuthenticated, pathname, router]);

    if (isLoading || (!isAuthenticated && pathname !== '/login') || (isAuthenticated && pathname === '/login')) {
        // Show a loader while authentication is resolving or a redirect is imminent.
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (isAuthenticated) {
        // User is authenticated and not on the login page. Show main layout.
        return (
            <>
                <MainLayout>{children}</MainLayout>
                <Toaster />
            </>
        );
    }
    
    // User is not authenticated and is on the login page. Show login page.
    return (
        <>
            {children}
            <Toaster /> 
        </>
    );
}
