
"use client";
import React from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAppContext } from '@/lib/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';


export default function SettingsPage() {
  const { clearAllPaymentHistories, isLoading } = useAppContext();
  const { toast } = useToast();

  const handleClearRevenue = async () => {
    try {
      await clearAllPaymentHistories();
      toast({
        title: "Success",
        description: "All student payment histories have been cleared. Dashboard revenue data is reset.",
      });
    } catch (error: any) {
      toast({
        title: "Error Clearing Data",
        description: error.message || "Could not clear payment histories. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Application Settings"
        description="Manage application-wide settings and data."
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-slide-in">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-destructive flex items-center">
                    <Trash2 className="mr-2 h-5 w-5" /> Danger Zone
                </CardTitle>
                <CardDescription>
                    Be extremely careful with actions in this section. They are irreversible.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className="font-semibold mb-1">Clear All Revenue Data</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                        This will permanently delete all payment records for all students. 
                        Dashboard revenue and fee due statistics will be reset. Student statuses will be adjusted.
                        This action cannot be undone.
                    </p>
                    <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isLoading}>
                        <Trash2 className="mr-2 h-4 w-4" /> Clear All Revenue Data
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action is permanent and cannot be undone. It will erase all student payment histories, resetting revenue data on the dashboard. Student statuses related to payments will also be reset.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleClearRevenue}
                            className={cn(buttonVariants({ variant: "destructive" }))}
                        >
                            Confirm & Clear Data
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
      </div>
    </>
  );
}
