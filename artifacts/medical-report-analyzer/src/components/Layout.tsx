import { Link, useLocation } from "wouter";
import { Activity, History, BarChart3, LayoutDashboard, Menu, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const navigation = [
    { name: "Analysis", href: "/", icon: Activity },
    { name: "History", href: "/history", icon: History },
    { name: "Statistics", href: "/stats", icon: BarChart3 },
  ];

  async function handleLogout() {
    await logout();
    toast({ title: "Signed out", description: "You have been signed out successfully." });
  }

  const NavLinks = () => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link key={item.name} href={item.href}>
            <span
              data-testid={`nav-link-${item.name.toLowerCase()}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </span>
          </Link>
        );
      })}
    </>
  );

  const UserSection = () => (
    <div className="border-t pt-4 mt-4 space-y-2">
      {user && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium truncate">{user.displayName}</span>
        </div>
      )}
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden border-r bg-card md:flex w-64 flex-col">
        <div className="flex h-14 items-center border-b px-4 gap-2 text-primary font-semibold">
          <LayoutDashboard className="w-5 h-5" />
          <span>Clinical Analyzer</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <NavLinks />
        </nav>
        <div className="px-4 pb-4">
          <UserSection />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b bg-card px-4 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" data-testid="btn-mobile-menu">
                <Menu className="w-5 h-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-14 items-center border-b px-4 gap-2 text-primary font-semibold">
                <LayoutDashboard className="w-5 h-5" />
                <span>Clinical Analyzer</span>
              </div>
              <nav className="space-y-1 p-4 flex-1">
                <NavLinks />
              </nav>
              <div className="px-4 pb-4">
                <UserSection />
              </div>
            </SheetContent>
          </Sheet>
          <div className="ml-4 flex items-center gap-2 text-primary font-semibold">
            <LayoutDashboard className="w-5 h-5" />
            <span>Clinical Analyzer</span>
          </div>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
