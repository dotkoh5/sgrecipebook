import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Search, Menu, X, BookOpen, LogOut } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface HeaderProps {
  showCategoryNav?: boolean;
}

export default function Header({ showCategoryNav = true }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, navigate] = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/recipes?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-border">
      <div className="container">
        <div className="flex items-center justify-between h-14 gap-4">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl sm:text-2xl font-serif text-foreground">SG Recipe Book</span>
            <img src="/logo.svg" alt="SG Recipe Book" className="h-7 sm:h-8 w-auto" />
          </Link>
          
          {/* Search bar - hidden on mobile, icon on right */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search home recipes..."
                className="search-input pr-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                <Search className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            </div>
          </form>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/submit">
              <Button className="btn-cta">
                Add My Mum's Recipe
              </Button>
            </Link>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="user-avatar cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
                    {getInitials(user?.name)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href={`/book/${user?.id}`} className="flex items-center gap-2 cursor-pointer">
                      <BookOpen className="h-4 w-4" />
                      <span>Recipe List</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <a href={getLoginUrl()}>
                <Button variant="outline" size="sm" className="rounded-full">
                  Log In
                </Button>
              </a>
            )}
          </div>

          {/* Mobile menu button */}
          <button 
            className="sm:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden py-4 border-t border-border space-y-4">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search recipes..."
                className="search-input pr-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                <Search className="h-4 w-4 text-muted-foreground" />
              </button>
            </form>
            <div className="flex flex-col gap-3">
              <Link href="/recipes" className="nav-link py-2" onClick={() => setMobileMenuOpen(false)}>
                Browse Recipes
              </Link>
              <Link href="/submit" onClick={() => setMobileMenuOpen(false)}>
                <Button className="btn-cta w-full">
                  Add My Mum's Recipe
                </Button>
              </Link>
              {isAuthenticated ? (
                <>
                  <Link 
                    href={`/book/${user?.id}`} 
                    className="nav-link py-2 flex items-center gap-2" 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="user-avatar text-sm">{getInitials(user?.name)}</span>
                    <span>Recipe List</span>
                  </Link>
                  <button 
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="nav-link py-2 flex items-center gap-2 text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                  </button>
                </>
              ) : (
                <a href={getLoginUrl()}>
                  <Button variant="outline" className="w-full rounded-full">
                    Log In
                  </Button>
                </a>
              )}
            </div>
          </div>
        )}
        
        {/* Secondary nav - hidden on mobile */}
        {showCategoryNav && (
          <div className="hidden md:flex items-center gap-8 h-12 border-t border-border overflow-x-auto">
            <Link href="/recipes?category=Main+Dish" className="nav-link whitespace-nowrap">Main Dishes</Link>
            <Link href="/recipes?category=Breakfast" className="nav-link whitespace-nowrap">Breakfast</Link>
            <Link href="/recipes?category=Snack" className="nav-link whitespace-nowrap">Snacks</Link>
            <Link href="/recipes?category=Dessert" className="nav-link whitespace-nowrap">Desserts</Link>
            <Link href="/recipes?category=Soup" className="nav-link whitespace-nowrap">Soups</Link>
            <Link href="/recipes?cuisineType=Peranakan" className="nav-link whitespace-nowrap">Peranakan</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
