import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ChefHat, Heart, Clock, Bookmark, Filter, Search } from "lucide-react";
import { Link, useSearch } from "wouter";
import { useState, useMemo, useEffect } from "react";

const categories = [
  "All Categories",
  "Main Dish",
  "Breakfast",
  "Snack",
  "Dessert",
  "Soup",
  "Side Dish",
  "Beverage",
];

const cuisineTypes = [
  "All Cuisines",
  "Chinese",
  "Malay",
  "Indian",
  "Peranakan",
];

const sortOptions = [
  { value: "recent", label: "Newest" },
  { value: "popular", label: "Most Popular" },
  { value: "mostLiked", label: "Most Liked" },
];

export default function Recipes() {
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "mostLiked">("recent");
  const [category, setCategory] = useState(params.get("category") || "All Categories");
  const [cuisineType, setCuisineType] = useState(params.get("cuisineType") || "All Cuisines");
  const [searchQuery, setSearchQuery] = useState(params.get("search") || "");

  // Sync URL params with state when URL changes
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    const urlCategory = newParams.get("category");
    const urlCuisineType = newParams.get("cuisineType");
    const urlSearch = newParams.get("search");
    
    if (urlCategory && urlCategory !== category) {
      setCategory(urlCategory);
    }
    if (urlCuisineType && urlCuisineType !== cuisineType) {
      setCuisineType(urlCuisineType);
    }
    if (urlSearch !== null && urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

  const { data: recipes, isLoading } = trpc.recipe.list.useQuery({
    limit: 50,
    sortBy,
    category: category === "All Categories" ? undefined : category,
    cuisineType: cuisineType === "All Cuisines" ? undefined : cuisineType,
  });

  const { data: recipeCount } = trpc.recipe.count.useQuery();

  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];
    if (!searchQuery.trim()) return recipes;
    
    const query = searchQuery.toLowerCase();
    return recipes.filter(
      (recipe) =>
        recipe.title.toLowerCase().includes(query) ||
        recipe.originalCookName.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query)
    );
  }, [recipes, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 py-6 sm:py-8">
        <div className="container">
          {/* Page Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="mb-2">Recipes</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Discover {recipeCount || filteredRecipes.length} family recipes from Singapore homes
            </p>
          </div>

          {/* Mobile Search */}
          <div className="md:hidden mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search recipes..."
                className="search-input pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-border">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filter:</span>
            </div>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[120px] sm:w-[140px] rounded-lg h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[140px] sm:w-[160px] rounded-lg h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={cuisineType} onValueChange={setCuisineType}>
              <SelectTrigger className="w-[120px] sm:w-[140px] rounded-lg h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cuisineTypes.map((cuisine) => (
                  <SelectItem key={cuisine} value={cuisine}>
                    {cuisine}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipe Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/3] bg-muted mb-2 sm:mb-3 rounded-lg" />
                  <div className="h-3 bg-muted w-16 mb-2 rounded" />
                  <div className="h-5 bg-muted w-full mb-2 rounded" />
                  <div className="h-4 bg-muted w-24 rounded" />
                </div>
              ))}
            </div>
          ) : filteredRecipes.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-x-6 sm:gap-y-10">
              {filteredRecipes.map((recipe) => (
                <article key={recipe.id} className="recipe-card group">
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
                    
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1 line-clamp-1">
                      By <span className="author-link">{recipe.originalCookName}</span>
                      {recipe.originalCookLocation && (
                        <span className="hidden sm:inline"> ({recipe.originalCookLocation})</span>
                      )}
                    </p>
                    
                    {recipe.submitter?.name && recipe.relationshipToSubmitter && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-2 line-clamp-1">
                        Shared by {recipe.submitter.name}, {recipe.relationshipToSubmitter}
                      </p>
                    )}
                    
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
              ))}
            </div>
          ) : (
            <div className="text-center py-12 sm:py-16">
              <ChefHat className="h-12 sm:h-16 w-12 sm:w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-serif mb-2">No recipes found</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">
                Try adjusting your filters or search terms
              </p>
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  setCategory("All Categories");
                  setCuisineType("All Cuisines");
                  setSearchQuery("");
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 sm:py-12 mt-8 sm:mt-12">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-serif text-foreground">SG Recipe Book</span>
              <img src="/logo.svg" alt="SG Recipe Book" className="h-6 sm:h-7 w-auto" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Preserving Singapore's home cooking heritage, one recipe at a time.
            </p>
            <div className="flex items-center gap-4 sm:gap-6">
              <Link href="/" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground">
                Home
              </Link>
              <Link href="/submit" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground">
                Submit
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
