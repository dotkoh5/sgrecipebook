import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { 
  ChefHat, Heart, Clock, UserPlus, UserMinus, 
  MapPin, Calendar, Loader2, ArrowLeft, BookOpen, Bookmark,
  Search, Share2, Pencil, Plus, MessageCircle, BookMarked
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useState, useMemo } from "react";

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id || "0");
  const { user: currentUser, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: profile, isLoading } = trpc.user.getById.useQuery(
    { id: userId },
    { enabled: userId > 0 }
  );

  const { data: recipes } = trpc.recipe.getByUser.useQuery(
    { userId, limit: 50 },
    { enabled: userId > 0 }
  );

  const { data: followers } = trpc.user.getFollowers.useQuery(
    { userId, limit: 50 },
    { enabled: userId > 0 }
  );

  const { data: following } = trpc.user.getFollowing.useQuery(
    { userId, limit: 50 },
    { enabled: userId > 0 }
  );

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "shared" | "alpha">("recent");
  const [, setLocation] = useLocation();

  // Filter and sort recipes
  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];
    
    let filtered = [...recipes];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.title.toLowerCase().includes(query) ||
        r.originalCookName?.toLowerCase().includes(query) ||
        r.category?.toLowerCase().includes(query)
      );
    }
    
    // Sort
    switch (sortBy) {
      case "shared":
        filtered.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        break;
      case "alpha":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "recent":
      default:
        // Already sorted by recent from API
        break;
    }
    
    return filtered;
  }, [recipes, searchQuery, sortBy]);

  // Share recipe book handler
  const handleShareRecipeBook = () => {
    const shareUrl = `https://sgrecipebook.com/book/${userId}`;
    const shareText = `This is my family recipe book ❤️\nWe're saving our home recipes here so they won't be lost. 👉`;
    
    // Try WhatsApp share first
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Share single recipe handler
  const handleShareRecipe = (e: React.MouseEvent, recipe: { title: string; slug: string }) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/recipe/${recipe.slug}`;
    const shareText = `Try this family recipe: ${recipe.title}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Edit recipe handler
  const handleEditRecipe = (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLocation(`/recipe/${slug}?edit=true`);
  };

  // Get relative time for "last edited"
  const getRelativeTime = (date: Date | string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const followMutation = trpc.social.follow.useMutation({
    onSuccess: () => {
      utils.user.getById.invalidate({ id: userId });
      utils.user.getFollowers.invalidate({ userId });
      toast.success("Following!");
    },
  });

  const unfollowMutation = trpc.social.unfollow.useMutation({
    onSuccess: () => {
      utils.user.getById.invalidate({ id: userId });
      utils.user.getFollowers.invalidate({ userId });
      toast.success("Unfollowed");
    },
  });

  const handleFollow = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!profile) return;
    
    if (profile.isFollowing) {
      unfollowMutation.mutate({ userId });
    } else {
      followMutation.mutate({ userId });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header showCategoryNav={false} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-serif mb-2">User Not Found</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">This user doesn't exist or has been removed.</p>
            <Link href="/">
              <Button className="rounded-lg">Go Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header showCategoryNav={false} />

      <main className="flex-1">
        {/* Profile Header */}
        <div className="border-b border-border">
          <div className="container py-8 sm:py-12">
            <div className="max-w-3xl mx-auto">
              <Link href="/recipes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to Recipes
              </Link>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24 bg-primary text-primary-foreground">
                  <AvatarImage src={profile.avatarUrl || undefined} />
                  <AvatarFallback className="text-2xl sm:text-3xl bg-primary text-primary-foreground">
                    {getInitials(profile.name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-2xl sm:text-3xl font-serif mb-1">
                    {profile.name || 'Anonymous'}'s Family Recipes
                  </h1>
                  
                  {/* Primary stat - recipe count */}
                  <p className="text-sm sm:text-base text-primary font-medium mb-2">
                    {profile.recipeCount} family {profile.recipeCount === 1 ? 'recipe' : 'recipes'} saved
                  </p>
                  
                  {profile.bio && (
                    <p className="text-sm sm:text-base text-muted-foreground mb-3">{profile.bio}</p>
                  )}
                  
                  <div className="flex flex-wrap justify-center sm:justify-start gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                    {profile.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 sm:h-4 w-3 sm:w-4" />
                        {profile.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 sm:h-4 w-3 sm:w-4" />
                      Joined {new Date(profile.createdAt).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex justify-center sm:justify-start gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                    <span><strong className="text-foreground">{profile.followerCount}</strong> followers</span>
                    <span><strong className="text-foreground">{profile.followingCount}</strong> following</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    {profile.isOwnProfile && profile.recipeCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShareRecipeBook}
                        className="rounded-lg"
                      >
                        <BookMarked className="h-4 w-4 mr-2" />
                        Share my recipe book
                      </Button>
                    )}
                    {!profile.isOwnProfile && (
                      <Button
                        variant={profile.isFollowing ? "outline" : "default"}
                        size="sm"
                        onClick={handleFollow}
                        disabled={followMutation.isPending || unfollowMutation.isPending}
                        className="rounded-lg"
                      >
                        {profile.isFollowing ? (
                          <>
                            <UserMinus className="h-4 w-4 mr-2" />
                            Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Follow
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="container py-8 sm:py-12">
          <div className="max-w-5xl mx-auto">
            <Tabs defaultValue="recipes" className="w-full">
              <TabsList className="w-full justify-start border-b border-border rounded-none h-auto p-0 bg-transparent mb-6 sm:mb-8 overflow-x-auto">
                <TabsTrigger 
                  value="recipes" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 sm:px-6 py-2 sm:py-3 gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap"
                >
                  <BookOpen className="h-3 sm:h-4 w-3 sm:w-4" />
                  Recipes ({profile.recipeCount})
                </TabsTrigger>
                <TabsTrigger 
                  value="followers" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm whitespace-nowrap"
                >
                  Followers ({profile.followerCount})
                </TabsTrigger>
                <TabsTrigger 
                  value="following" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm whitespace-nowrap"
                >
                  Following ({profile.followingCount})
                </TabsTrigger>
              </TabsList>

              {/* Recipes Tab */}
              <TabsContent value="recipes" className="mt-0">
                {/* Search and Sort Controls */}
                {recipes && recipes.length > 0 && (
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search your recipes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 rounded-lg"
                      />
                    </div>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as "recent" | "shared" | "alpha")}>
                      <SelectTrigger className="w-full sm:w-[180px] rounded-lg">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Recently added</SelectItem>
                        <SelectItem value="shared">Most shared</SelectItem>
                        <SelectItem value="alpha">Alphabetical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {filteredRecipes && filteredRecipes.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-x-6 sm:gap-y-10">
                      {filteredRecipes.map((recipe) => (
                        <article key={recipe.id} className="recipe-card group relative">
                          <Link href={`/recipe/${recipe.slug}`} className="block">
                            {/* Recipe Cover Card */}
                            <div className="aspect-[4/3] overflow-hidden mb-2 sm:mb-3 relative rounded-lg">
                              {recipe.imageUrl ? (
                                <img 
                                  src={recipe.imageUrl} 
                                  alt={recipe.title}
                                  className="w-full h-full object-cover recipe-image"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 p-3 sm:p-4">
                                  <ChefHat className="h-6 sm:h-8 w-6 sm:w-8 text-primary/30 mb-2" />
                                  <p className="text-xs sm:text-sm font-serif text-center text-foreground/80 line-clamp-2 mb-1">
                                    {recipe.title}
                                  </p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                                    {profile.name}'s family recipe
                                  </p>
                                  <p className="text-[8px] sm:text-[10px] text-muted-foreground/60 mt-2">
                                    SG Recipe Book
                                  </p>
                                </div>
                              )}
                              
                              {/* Action buttons on hover */}
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => handleShareRecipe(e, recipe)}
                                  className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors shadow-sm"
                                  title="Share with family"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </button>
                                {profile.isOwnProfile && (
                                  <button 
                                    onClick={(e) => handleEditRecipe(e, recipe.slug)}
                                    className="p-1.5 bg-white/90 text-foreground rounded-full hover:bg-white transition-colors shadow-sm"
                                    title="Edit recipe"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {recipe.category && (
                              <p className="category-label mb-1 text-[10px] sm:text-xs">{recipe.category}</p>
                            )}
                            
                            <h3 className="text-sm sm:text-lg font-serif mb-1 group-hover:text-primary transition-colors line-clamp-2">
                              {recipe.title}
                            </h3>
                            
                            <p className="text-xs sm:text-sm text-muted-foreground mb-1 line-clamp-1">
                              By {recipe.originalCookName}
                              {recipe.originalCookLocation && (
                                <span className="hidden sm:inline"> ({recipe.originalCookLocation})</span>
                              )}
                            </p>
                            
                            {/* Last edited microcopy */}
                            {profile.isOwnProfile && recipe.updatedAt && (
                              <p className="text-[10px] sm:text-xs text-muted-foreground/70 mb-1">
                                Edited {getRelativeTime(recipe.updatedAt)}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                              {(recipe.prepTimeMinutes || recipe.cookTimeMinutes) && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                                  {(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)} min
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                                {recipe.viewCount}
                              </span>
                            </div>
                          </Link>
                        </article>
                      ))}
                    </div>
                    
                    {/* Add Another Recipe CTA */}
                    {profile.isOwnProfile && (
                      <div className="mt-8 sm:mt-12">
                        <Link href="/submit">
                          <div className="border-2 border-dashed border-border rounded-lg p-6 sm:p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer">
                            <Plus className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                            <p className="font-serif text-base sm:text-lg mb-1">Add another family recipe</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">Most families save 3–5 recipes</p>
                          </div>
                        </Link>
                      </div>
                    )}
                  </>
                ) : recipes && recipes.length > 0 && searchQuery ? (
                  <div className="text-center py-12 sm:py-16">
                    <Search className="h-12 sm:h-16 w-12 sm:w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg sm:text-xl font-serif mb-2">No recipes found</h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4">
                      No recipes match "{searchQuery}"
                    </p>
                    <Button variant="outline" onClick={() => setSearchQuery("")} className="rounded-lg">
                      Clear search
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12 sm:py-16">
                    <ChefHat className="h-12 sm:h-16 w-12 sm:w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg sm:text-xl font-serif mb-2">No recipes yet</h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-6">
                      {profile.isOwnProfile 
                        ? "Share your family's recipes with the community!" 
                        : "No recipes shared yet."}
                    </p>
                    {profile.isOwnProfile && (
                      <Link href="/submit">
                        <Button className="rounded-lg">Add My Mum's Recipe</Button>
                      </Link>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Followers Tab */}
              <TabsContent value="followers" className="mt-0">
                {followers && followers.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
                    {followers.map((follower) => (
                      <Link key={follower.id} href={`/book/${follower.id}`}>
                        <div className="p-3 sm:p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-3 sm:gap-4">
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 bg-primary text-primary-foreground">
                            <AvatarImage src={follower.avatarUrl || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {getInitials(follower.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm sm:text-base">{follower.name || 'Anonymous'}</p>
                            {follower.location && (
                              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {follower.location}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 sm:py-16">
                    <UserPlus className="h-12 sm:h-16 w-12 sm:w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg sm:text-xl font-serif mb-2">No followers yet</h3>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-sm mx-auto">
                      {profile.isOwnProfile 
                        ? "When you share your recipes, followers will appear here." 
                        : "This user doesn't have any followers yet."}
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Following Tab */}
              <TabsContent value="following" className="mt-0">
                {following && following.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
                    {following.map((user) => (
                      <Link key={user.id} href={`/book/${user.id}`}>
                        <div className="p-3 sm:p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-3 sm:gap-4">
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 bg-primary text-primary-foreground">
                            <AvatarImage src={user.avatarUrl || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm sm:text-base">{user.name || 'Anonymous'}</p>
                            {user.location && (
                              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {user.location}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 sm:py-16">
                    <BookOpen className="h-12 sm:h-16 w-12 sm:w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg sm:text-xl font-serif mb-2">Not following anyone</h3>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-sm mx-auto mb-6">
                      {profile.isOwnProfile 
                        ? "Follow other families to discover their recipes." 
                        : "This user isn't following anyone yet."}
                    </p>
                    {profile.isOwnProfile && (
                      <Link href="/recipes">
                        <Button variant="outline" className="rounded-lg">Discover recipes</Button>
                      </Link>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
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
              Preserving Singapore's home cooking heritage, one recipe at a time.
            </p>
            <div className="flex items-center gap-4 sm:gap-6">
              <Link href="/recipes" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground">
                Recipes
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
