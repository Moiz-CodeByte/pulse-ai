import { AppLogo } from '@/components/ui/AppLogo';

export function Footer() {
  return (
    <footer className="mt-12 py-6 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AppLogo className="h-5 w-5" />
            <span className="font-display font-semibold text-foreground">Pulse AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Pulse AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
