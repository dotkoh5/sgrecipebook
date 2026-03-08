import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ChefHat, Heart, Clock, Plus, Bookmark, BookOpen, Search, TrendingUp, Users } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function HomeFeed() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Get popular recipes this week
  const { data: popularRecipes } = trpc.recipe.list.useQuery({ 
    limit: 4, 
    sortBy: "popular" 
  });
  
  // Get recent recipes from families
  const { data: familyRecipes } = trpc.recipe.list.useQuery({ 
    limit: 4, 
    sortBy: "recent" 
  });

  // Get user's own recipes count
  const { data: userRecipes } = trpc.recipe.getByUser.useQuery(
    { userId: user?.id ?? 0, limit: 100 },
    { enabled: !!user }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/recipes?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1">
        {/* Hero Search Section */}
        <section className="bg-gradient-to-b from-red-50 to-white py-12 sm:py-16">
          <div className="container">
            <div className="max-w-2xl mx-auto text-center">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif mb-4">
                What would you like to cook today?
              </h1>
              <p className="text-muted-foreground mb-8">
                Search by dish, ingredient, or craving
              </p>
              
              <form onSubmit={handleSearch} className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Chicken rice, laksa, curry..."
                  className="w-full h-14 pl-12 pr-4 rounded-full border-2 border-border bg-white text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </form>
            </div>
          </div>
        </section>

        {/* Quick Action Bar */}
        <section className="border-b border-border py-6">
          <div className="container">
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              <Link href="/submit">
                <Button size="lg" className="rounded-full px-6 h-12 gap-2">
                  <Plus className="h-5 w-5" />
                  Add Mum's Recipe
                </Button>
              </Link>
              <Link href="/recipes?saved=true">
                <Button variant="outline" size="lg" className="rounded-full px-6 h-12 gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Saved Recipes
                </Button>
              </Link>
              <Link href={user ? `/book/${user.id}` : "/recipes"}>
                <Button variant="outline" size="lg" className="rounded-full px-6 h-12 gap-2">
                  <BookOpen className="h-5 w-5" />
                  My Recipe Book
                  {userRecipes && userRecipes.length > 0 && (
                    <span className="ml-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-sm">
                      {userRecipes.length}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Popular This Week */}
        <section className="py-10 sm:py-14">
          <div className="container">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-serif">Popular This Week</h2>
                <p className="text-sm text-muted-foreground">Most loved recipes by the community</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {popularRecipes?.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </div>
        </section>

        {/* From Families Like Yours */}
        <section className="py-10 sm:py-14 bg-muted/30">
          <div className="container">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-serif">From Families Like Yours</h2>
                <p className="text-sm text-muted-foreground">Recipes passed down through generations</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {familyRecipes?.map((recipe) => (
                <FamilyRecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
            
            <div className="text-center mt-8">
              <Link href="/recipes">
                <Button variant="outline" size="lg" className="rounded-full px-8">
                  Browse All Recipes
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Encourage Contribution */}
        <section className="py-12 sm:py-16 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="container text-center">
            <h2 className="text-2xl sm:text-3xl font-serif mb-4">
              Have a family recipe to share?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Every recipe you add helps preserve Singapore's home cooking heritage. 
              Even messy notes are welcome — we'll help tidy them up.
            </p>
            <Link href="/submit">
              <Button size="lg" className="rounded-full px-8 h-12">
                <Plus className="h-5 w-5 mr-2" />
                Add My Mum's Recipe
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 sm:py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-serif text-foreground">SG Recipe Book</span>
              <img src="/logo.svg" alt="SG Recipe Book" className="h-6 sm:h-7 w-auto" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Preserving Singapore's home cooking heritage — one family recipe at a time.
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              © advarktech 2025
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Recipe Card Component
function RecipeCard({ recipe }: { recipe: any }) {
  return (
    <article className="recipe-card group">
      <Link href={`/recipe/${recipe.slug}`} className="block">
        <div className="aspect-[4/3] bg-muted overflow-hidden mb-2 sm:mb-3 relative rounded-lg">
          {recipe.imageUrl ? (
            <img 
              src={recipe.imageUrl} 
              alt={recipe.title}
              className="w-full h-full object-cover recipe-image"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
              <ChefHat className="h-8 sm:h-12 w-8 sm:w-12 text-primary/20" />
            </div>
          )}
          <button className="bookmark-btn absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Bookmark className="h-4 w-4" />
          </button>
        </div>
        
        {recipe.category && (
          <p className="category-label mb-1 text-[10px] sm:text-xs">{recipe.category}</p>
        )}
        
        <h3 className="text-sm sm:text-lg font-serif mb-1 group-hover:text-primary transition-colors line-clamp-2">
          {recipe.title}
        </h3>
        
        <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2 line-clamp-1">
          By {recipe.originalCookName}
        </p>
        
        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Heart className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
            {recipe.likeCount}
          </span>
          {(recipe.prepTimeMinutes || recipe.cookTimeMinutes) && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              {(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)} min
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}

// Family Recipe Card Component - emphasizes attribution
function FamilyRecipeCard({ recipe }: { recipe: any }) {
  return (
    <article className="group">
      <Link href={`/recipe/${recipe.slug}`} className="block">
        {/* Recipe Image or Designed Cover */}
        <div className="aspect-[4/3] rounded-lg overflow-hidden mb-3 relative bg-gradient-to-br from-orange-50 via-red-50 to-orange-100">
          {recipe.imageUrl ? (
            <img 
              src={recipe.imageUrl} 
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <ChefHat className="h-8 w-8 text-primary/30 mb-2" />
              <h4 className="font-serif text-lg sm:text-xl text-foreground line-clamp-2 mb-1">
                {recipe.title}
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {recipe.originalCookName}'s family recipe
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-2">
                SG Recipe Book
              </p>
            </div>
          )}
        </div>
        
        {/* Attribution */}
        <div className="space-y-1">
          <p className="text-sm sm:text-base font-medium group-hover:text-primary transition-colors">
            {recipe.title}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            By <span className="font-medium">{recipe.originalCookName}</span>
            {recipe.originalCookLocation && (
              <span className="text-muted-foreground/70"> ({recipe.originalCookLocation})</span>
            )}
          </p>
        </div>
      </Link>
    </article>
  );
}
