import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { ChefHat, Heart, Clock, ArrowRight, Bookmark, FileText, Sparkles, Share2 } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  
  const { data: featuredRecipes } = trpc.recipe.list.useQuery({ 
    limit: 1, 
    sortBy: "popular" 
  });
  
  const { data: recentRecipes } = trpc.recipe.list.useQuery({ 
    limit: 8, 
    sortBy: "recent" 
  });

  const { data: recipeCount } = trpc.recipe.count.useQuery();

  const featuredRecipe = featuredRecipes?.[0];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border">
          <div className="container py-8 sm:py-12 md:py-16">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-16 items-center">
              {/* Hero Image - Always use static image for consistent appeal */}
              <div className="aspect-[4/3] bg-muted overflow-hidden rounded-lg">
                <img 
                  src="/hero-image.jpg" 
                  alt="Singaporean home cooking"
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Hero Content */}
              <div className="lg:py-8">
                <p className="category-label mb-3 sm:mb-4">Our Mission</p>
                <h1 className="mb-4 sm:mb-6">
                  Help Preserve Singapore's Home Recipes — Before They're Lost
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-lg">
                  Hawker food is documented. Mum's recipes aren't.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <Link href="/submit">
                    <Button size="lg" className="w-full sm:w-auto rounded-lg px-6 sm:px-8 h-11 sm:h-12 text-base">
                      Add My Mum's Recipe
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/recipes">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-lg px-6 sm:px-8 h-11 sm:h-12 text-base">
                      Browse Home Recipes
                    </Button>
                  </Link>
                </div>
                
                <p className="mt-6 sm:mt-8 text-sm text-muted-foreground">
                  {recipeCount || 50} Singaporean family recipes preserved ❤️
                </p>

                {/* Testimonial Quote */}
                <blockquote className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm sm:text-base italic text-muted-foreground">
                    "My mum never wrote her recipes down. Now my siblings all have it."
                  </p>
                  <footer className="mt-2 text-xs sm:text-sm text-muted-foreground">
                    — D. Koh, Novena
                  </footer>
                </blockquote>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="border-b border-border bg-muted/30">
          <div className="container py-10 sm:py-14">
            <h2 className="text-center mb-8 sm:mb-10">How It Works</h2>
            <div className="grid sm:grid-cols-3 gap-6 sm:gap-8 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                </div>
                <p className="text-sm sm:text-base font-semibold mb-1">Step 1</p>
                <p className="text-sm sm:text-base text-foreground font-medium mb-1">
                  Add your mum or grandma's recipe
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Even messy notes are welcome
                </p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                </div>
                <p className="text-sm sm:text-base font-semibold mb-1">Step 2</p>
                <p className="text-sm sm:text-base text-foreground font-medium mb-1">
                  We help tidy it up using AI — without changing it
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  The original recipe is always preserved
                </p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Share2 className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                </div>
                <p className="text-sm sm:text-base font-semibold mb-1">Step 3</p>
                <p className="text-sm sm:text-base text-foreground font-medium mb-1">
                  Share it with family & friends
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  So it's never lost again
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Recipe of the Day */}
        {featuredRecipe && (
          <section className="border-b border-border">
            <div className="container py-8 sm:py-12">
              <div className="grid lg:grid-cols-5 gap-6 lg:gap-12">
                <div className="lg:col-span-3">
                  <Link href={`/recipe/${featuredRecipe.slug}`} className="block group">
                    <div className="aspect-[16/10] bg-muted overflow-hidden rounded-lg">
                      {featuredRecipe.imageUrl ? (
                        <img 
                          src={featuredRecipe.imageUrl} 
                          alt={featuredRecipe.title}
                          className="w-full h-full object-cover recipe-image"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-red-50">
                          <ChefHat className="h-24 sm:h-32 w-24 sm:w-32 text-primary/20" />
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
                
                <div className="lg:col-span-2 flex flex-col justify-center">
                  <p className="category-label mb-2 sm:mb-3">Recipe of the Day</p>
                  <Link href={`/recipe/${featuredRecipe.slug}`}>
                    <h2 className="mb-2 sm:mb-3 hover:text-primary transition-colors">
                      {featuredRecipe.title}
                    </h2>
                  </Link>
                  <p className="text-muted-foreground mb-2">
                    By <span className="author-link">{featuredRecipe.originalCookName}</span>
                    {featuredRecipe.originalCookLocation && ` (${featuredRecipe.originalCookLocation})`}
                  </p>
                  <p className="text-muted-foreground mb-4 line-clamp-3">
                    {featuredRecipe.description}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      <span>{featuredRecipe.likeCount}</span>
                    </div>
                    {(featuredRecipe.prepTimeMinutes || featuredRecipe.cookTimeMinutes) && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          {(featuredRecipe.prepTimeMinutes || 0) + (featuredRecipe.cookTimeMinutes || 0)} min
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Recent Recipes Grid */}
        <section className="py-8 sm:py-12">
          <div className="container">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <h2>Latest Recipes</h2>
              <Link href="/recipes" className="text-sm font-medium text-primary hover:underline">
                View All →
              </Link>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {recentRecipes?.map((recipe) => (
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
                    
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2 line-clamp-1">
                      By {recipe.originalCookName}
                    </p>
                    
                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                        {recipe.likeCount}
                      </span>
                      {(recipe.prepTimeMinutes || recipe.cookTimeMinutes) && (
                        <span className="hidden sm:inline">
                          {(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)} min
                        </span>
                      )}
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-muted py-12 sm:py-16">
          <div className="container text-center px-6">
            <h2 className="mb-4">Share Your Family's Home Recipe</h2>
            <p className="text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base">
              Every family has a recipe passed down through generations. 
              Help preserve Singapore's home cooking heritage before these treasures are lost.
            </p>
            <Link href="/submit">
              <Button size="lg" className="rounded-lg px-6 sm:px-8 h-11 sm:h-12">
                Add My Mum's Recipe
                <ArrowRight className="ml-2 h-4 w-4" />
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
