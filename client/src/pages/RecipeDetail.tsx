import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import {
  Heart, MessageCircle, Clock, Users, ArrowLeft,
  Share2, UserPlus, UserMinus, Send, Loader2,
  Printer, Star, Eye, EyeOff, Copy, Check, Pencil, X, ImagePlus, Trash2, Plus
} from "lucide-react";
import { Link, useParams } from "wouter";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// WhatsApp icon component
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function RecipeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const [comment, setComment] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [shortLinkCopied, setShortLinkCopied] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedIngredients, setEditedIngredients] = useState<string[]>([]);
  const [editedInstructions, setEditedInstructions] = useState<string[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: recipe, isLoading } = trpc.recipe.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  const { data: comments } = trpc.comment.list.useQuery(
    { recipeId: recipe?.id || 0 },
    { enabled: !!recipe?.id }
  );

  const likeMutation = trpc.social.like.useMutation({
    onSuccess: () => utils.recipe.getBySlug.invalidate({ slug }),
  });

  const unlikeMutation = trpc.social.unlike.useMutation({
    onSuccess: () => utils.recipe.getBySlug.invalidate({ slug }),
  });

  const followMutation = trpc.social.follow.useMutation({
    onSuccess: () => utils.recipe.getBySlug.invalidate({ slug }),
  });

  const unfollowMutation = trpc.social.unfollow.useMutation({
    onSuccess: () => utils.recipe.getBySlug.invalidate({ slug }),
  });

  const commentMutation = trpc.comment.create.useMutation({
    onSuccess: () => {
      setComment("");
      utils.comment.list.invalidate({ recipeId: recipe?.id });
      utils.recipe.getBySlug.invalidate({ slug });
      toast.success("Comment added!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add comment");
    },
  });

  const updateMutation = trpc.recipe.update.useMutation({
    onSuccess: () => {
      utils.recipe.getBySlug.invalidate({ slug });
      setIsEditMode(false);
      toast.success("Recipe updated!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update recipe");
    },
  });

  const regenerateImageMutation = trpc.recipe.regenerateImage.useMutation({
    onSuccess: () => {
      utils.recipe.getBySlug.invalidate({ slug });
      toast.success("New image generated!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate image");
    },
  });

  // Initialize edit mode with current values
  const handleStartEdit = () => {
    if (recipe) {
      setEditedIngredients([...recipe.ingredients]);
      setEditedInstructions([...recipe.instructions]);
      setIsEditMode(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedIngredients([]);
    setEditedInstructions([]);
  };

  const handleSaveEdit = () => {
    if (!recipe) return;
    // Filter out empty entries before saving
    const cleanIngredients = editedIngredients.filter(i => i.trim());
    const cleanInstructions = editedInstructions.filter(i => i.trim());
    updateMutation.mutate({
      id: recipe.id,
      ingredients: cleanIngredients.length > 0 ? cleanIngredients : editedIngredients,
      instructions: cleanInstructions.length > 0 ? cleanInstructions : editedInstructions,
    });
  };

  // Check if current user can edit this recipe
  const canEdit = isAuthenticated && recipe && (
    user?.id === recipe.submittedById || user?.role === 'admin'
  );

  const handleLike = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!recipe) return;
    
    if (recipe.isLiked) {
      unlikeMutation.mutate({ recipeId: recipe.id });
    } else {
      likeMutation.mutate({ recipeId: recipe.id });
    }
  };

  const handleFollow = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!recipe?.submitter) return;
    
    if (recipe.isFollowingSubmitter) {
      unfollowMutation.mutate({ userId: recipe.submitter.id });
    } else {
      followMutation.mutate({ userId: recipe.submitter.id });
    }
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !recipe) return;
    commentMutation.mutate({ recipeId: recipe.id, content: comment.trim() });
  };

  // Generate short link URL
  const shortLink = recipe?.shortCode 
    ? `https://sgrecipebook.com/r/${recipe.shortCode}` 
    : `https://sgrecipebook.com/recipe/${recipe?.slug}`;

  const handleCopyShortLink = async () => {
    await navigator.clipboard.writeText(shortLink);
    setShortLinkCopied(true);
    toast.success("Short link copied!");
    setTimeout(() => setShortLinkCopied(false), 2000);
  };

  // Scroll detection for sticky action bar
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const heroBottom = heroRef.current.getBoundingClientRect().bottom;
        setShowStickyBar(heroBottom < 0);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleWhatsAppShare = () => {
    if (!recipe) return;
    const message = `This is my family's ${recipe.title} recipe:\n👉 https://sgrecipebook.com/recipe/${recipe.slug}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleShare = async () => {
    if (!recipe) return;
    const url = `https://sgrecipebook.com/recipe/${recipe.slug}`;
    const shareText = `This is my family's ${recipe.title} recipe:\n👉 ${url}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe.title,
          text: shareText,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success("Share message copied to clipboard!");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header showCategoryNav={false} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-serif mb-2">Recipe Not Found</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">This recipe may have been removed or doesn't exist.</p>
            <Link href="/recipes">
              <Button className="rounded-lg">Browse Recipes</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalTime = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);

  // Open Graph meta data
  const ogTitle = `${recipe.title} — ${recipe.originalCookName}'s Recipe`;
  const ogDescription = recipe.description || `A treasured family recipe for ${recipe.title} shared by ${recipe.submitter?.name || 'a home cook'} to preserve Singapore's home cooking heritage.`;
  const ogImage = recipe.imageUrl || 'https://sgrecipebook.com/og-image.png';
  const ogUrl = `https://sgrecipebook.com/recipe/${recipe.slug}`;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Helmet>
        <title>{ogTitle} | SG Recipe Book</title>
        <meta property="og:type" content="article" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={ogUrl} />
        <meta property="og:site_name" content="SG Recipe Book" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>
      <Header showCategoryNav={false} />

      <main className="flex-1">
        {/* Sticky Action Bar - appears when scrolling past hero */}
        <div 
          className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm transition-transform duration-300 ${showStickyBar ? 'translate-y-0' : '-translate-y-full'}`}
        >
          <div className="container py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Link href="/recipes" className="text-muted-foreground hover:text-foreground shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="min-w-0">
                  <h2 className="font-serif text-lg truncate">{recipe?.title}</h2>
                  <p className="text-xs text-muted-foreground truncate">By {recipe?.originalCookName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant={recipe?.isLiked ? "default" : "outline"}
                  size="sm"
                  onClick={handleLike}
                  disabled={likeMutation.isPending || unlikeMutation.isPending}
                  className="rounded-lg"
                >
                  <Heart className={`h-4 w-4 ${recipe?.isLiked ? 'fill-current' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-whatsapp"
                  onClick={handleWhatsAppShare}
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare} className="rounded-lg hidden sm:flex">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-lg hidden md:flex">
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Recipe Header / Hero Section */}
        <div ref={heroRef} className="border-b border-border">
          <div className="container py-6 sm:py-8">
            <Link href="/recipes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Recipes
            </Link>

            <div className="max-w-3xl">
              {recipe.category && (
                <p className="category-label mb-2 sm:mb-3">{recipe.category}</p>
              )}
              
              <h1 className="mb-3 sm:mb-4">{recipe.title}</h1>
              
              <p className="text-base sm:text-lg text-muted-foreground mb-2 sm:mb-4">
                By <span className="author-link">{recipe.originalCookName}</span>
                {recipe.originalCookLocation && ` (${recipe.originalCookLocation})`}
              </p>
              
              {recipe.submitter?.name && recipe.relationshipToSubmitter && (
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                  Shared by {recipe.submitter.name}, {recipe.relationshipToSubmitter}
                </p>
              )}

              {recipe.description && (
                <p className="text-base sm:text-lg leading-relaxed mb-4 sm:mb-6">{recipe.description}</p>
              )}

              {/* Recipe Stats */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm mb-4 sm:mb-6">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      className={`h-4 w-4 ${star <= 4 ? 'fill-foreground text-foreground' : 'text-border'}`} 
                    />
                  ))}
                  <span className="text-muted-foreground ml-1">{recipe.likeCount}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground pb-4 sm:pb-6 border-b border-border">
                {totalTime > 0 && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{totalTime} min</span>
                  </div>
                )}
                {recipe.servings && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{recipe.servings} servings</span>
                  </div>
                )}
                {recipe.cuisineType && (
                  <span>{recipe.cuisineType}</span>
                )}
                {recipe.difficulty && (
                  <span className="capitalize">{recipe.difficulty}</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-4 sm:pt-6">
                {canEdit && !isEditMode && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleStartEdit}
                      className="rounded-lg text-xs sm:text-sm"
                    >
                      <Pencil className="h-4 w-4 mr-1 sm:mr-2" />
                      Edit Recipe
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => recipe && regenerateImageMutation.mutate({ id: recipe.id })}
                      disabled={regenerateImageMutation.isPending}
                      className="rounded-lg text-xs sm:text-sm"
                    >
                      {regenerateImageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 sm:mr-2 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4 mr-1 sm:mr-2" />
                      )}
                      {regenerateImageMutation.isPending ? 'Generating...' : 'New Image'}
                    </Button>
                  </>
                )}
                <Button
                  variant={recipe.isLiked ? "default" : "outline"}
                  size="sm"
                  onClick={handleLike}
                  disabled={likeMutation.isPending || unlikeMutation.isPending}
                  className="rounded-lg text-xs sm:text-sm"
                >
                  <Heart className={`h-4 w-4 mr-1 sm:mr-2 ${recipe.isLiked ? 'fill-current' : ''}`} />
                  {recipe.isLiked ? 'Saved' : 'Save'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-whatsapp text-xs sm:text-sm"
                  onClick={handleWhatsAppShare}
                >
                  <WhatsAppIcon className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Share to </span>WhatsApp
                </Button>
                
                <Button variant="outline" size="sm" onClick={handleShare} className="rounded-lg text-xs sm:text-sm">
                  <Share2 className="h-4 w-4 mr-1 sm:mr-2" />
                  Share
                </Button>
                
                <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-lg text-xs sm:text-sm hidden sm:flex">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>

              {/* Short Link for Sharing */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Share this family recipe <span className="text-primary">❤️</span></p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm font-mono truncate">
                    {shortLink}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyShortLink}
                    className="rounded-lg shrink-0"
                  >
                    {shortLinkCopied ? (
                      <><Check className="h-4 w-4 mr-1" /> Copied</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Copy</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recipe Image */}
        {recipe.imageUrl && (
          <div className="border-b border-border">
            <div className="container py-6 sm:py-8">
              <div className="max-w-4xl mx-auto">
                <img 
                  src={recipe.imageUrl} 
                  alt={recipe.title}
                  className="w-full aspect-[16/10] object-cover rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Edit Mode Banner */}
        {isEditMode && (
          <div className="bg-amber-50 border-b border-amber-200">
            <div className="container py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Editing Recipe</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="rounded-lg text-xs"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    className="rounded-lg text-xs"
                  >
                    {updateMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
                    ) : (
                      <><Check className="h-4 w-4 mr-1" /> Save Changes</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recipe Content - Cook Mode Split Layout */}
        <div className={`container py-8 sm:py-12 ${isEditMode ? 'bg-amber-50/30' : ''}`}>
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
              {/* Ingredients - Sticky on desktop */}
              <div className="lg:w-[380px] lg:flex-shrink-0">
                <div className="lg:sticky lg:top-4">
                  <h2 className="text-lg sm:text-xl font-serif mb-4 sm:mb-6 pb-3 border-b border-border">Ingredients</h2>
                  <div className="lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-2 scrollbar-thin">
                    {isEditMode ? (
                      <Textarea
                        value={editedIngredients.join('\n')}
                        onChange={(e) => setEditedIngredients(e.target.value.split('\n'))}
                        className="min-h-[400px] text-sm font-mono bg-white"
                        placeholder="Enter ingredients, one per line..."
                      />
                    ) : (
                      <div className="space-y-1">
                        {(() => {
                          // Group ingredients by section headers
                          const groups: { header: string | null; items: string[] }[] = [];
                          let currentGroup: { header: string | null; items: string[] } = { header: null, items: [] };
                          
                          recipe.ingredients.forEach((ingredient) => {
                            // Check if this is a section header (e.g., "For the Chicken:", "Curry Paste:", "Garnish:")
                            const isHeader = ingredient.endsWith(':') && !ingredient.includes(',') && ingredient.length < 60;
                            
                            if (isHeader) {
                              if (currentGroup.items.length > 0 || currentGroup.header) {
                                groups.push(currentGroup);
                              }
                              currentGroup = { header: ingredient, items: [] };
                            } else {
                              currentGroup.items.push(ingredient);
                            }
                          });
                          
                          // Push the last group
                          if (currentGroup.items.length > 0 || currentGroup.header) {
                            groups.push(currentGroup);
                          }
                          
                          return groups.map((group, groupIndex) => (
                            <div key={groupIndex} className={`${groupIndex > 0 ? 'mt-6' : ''}`}>
                              {group.header && (
                                <div className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border/50">
                                  {group.header}
                                </div>
                              )}
                              <div className={`${group.header ? 'bg-muted/30 rounded-lg p-3' : ''}`}>
                                <ul className="space-y-0">
                                  {group.items.map((ingredient, index) => (
                                    <li key={index} className="py-2 text-sm text-foreground/90 border-b border-border/30 last:border-b-0">
                                      {ingredient}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Instructions - Scrollable */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 border-b border-border">
                  <h2 className="text-lg sm:text-xl font-serif">Preparation</h2>
                  {/* View Original Notes toggle */}
                  {!isEditMode && (recipe.originalIngredients || recipe.originalInstructions) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowOriginal(!showOriginal)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showOriginal ? (
                        <><EyeOff className="h-4 w-4 mr-1" /> Hide Original</>
                      ) : (
                        <><Eye className="h-4 w-4 mr-1" /> View Original Notes</>
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Show original messy notes if toggled */}
                {showOriginal && !isEditMode && (recipe.originalIngredients || recipe.originalInstructions) && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-medium text-amber-800 mb-3">Original notes from {recipe.originalCookName}</p>
                    {recipe.originalIngredients && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Ingredients:</p>
                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{recipe.originalIngredients}</p>
                      </div>
                    )}
                    {recipe.originalInstructions && (
                      <div>
                        <p className="text-xs font-semibold text-amber-700 mb-1">Instructions:</p>
                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{recipe.originalInstructions}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {isEditMode ? (
                  <div className="space-y-3">
                    {editedInstructions.map((instruction, index) => (
                      <div key={index} className="flex gap-3 group">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center mt-1">
                          {index + 1}
                        </div>
                        <Textarea
                          value={instruction}
                          onChange={(e) => {
                            const newInstructions = [...editedInstructions];
                            newInstructions[index] = e.target.value;
                            setEditedInstructions(newInstructions);
                          }}
                          className="flex-1 min-h-[60px] text-sm leading-relaxed resize-y"
                          placeholder={`Step ${index + 1}...`}
                        />
                        {editedInstructions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditedInstructions(editedInstructions.filter((_, i) => i !== index));
                            }}
                            className="flex-shrink-0 w-7 h-7 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 mt-1"
                            title="Remove step"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditedInstructions([...editedInstructions, ''])}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors ml-11"
                    >
                      <Plus className="w-4 h-4" />
                      Add step
                    </button>
                  </div>
                ) : (
                  <ol className="space-y-6">
                    {recipe.instructions.map((instruction, index) => (
                      <li key={index} className="flex gap-4 pb-6 border-b border-border/50 last:border-b-0 last:pb-0">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary text-base font-bold flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div className="flex-1 pt-2">
                          <p className="text-base leading-relaxed text-foreground">{instruction}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tips Section */}
        {recipe.tips && (
          <div className="bg-muted border-y border-border">
            <div className="container py-8 sm:py-12">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-lg sm:text-xl font-serif mb-3 sm:mb-4">Tips from {recipe.originalCookName}</h2>
                <p className="text-base sm:text-lg italic text-muted-foreground leading-relaxed">
                  "{recipe.tips}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contributor Section */}
        {recipe.submitter && (
          <div className="border-b border-border">
            <div className="container py-8 sm:py-12">
              <div className="max-w-3xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <Link href={`/book/${recipe.submitter.id}`} className="flex items-center gap-3 sm:gap-4">
                    <Avatar className="h-12 w-12 sm:h-14 sm:w-14 bg-primary text-primary-foreground">
                      <AvatarImage src={recipe.submitter.avatarUrl || undefined} />
                      <AvatarFallback className="text-base sm:text-lg bg-primary text-primary-foreground">
                        {getInitials(recipe.submitter.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-base sm:text-lg">{recipe.submitter.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Recipe Contributor</p>
                    </div>
                  </Link>
                  {user?.id !== recipe.submitter.id && (
                    <Button
                      variant={recipe.isFollowingSubmitter ? "outline" : "default"}
                      size="sm"
                      onClick={handleFollow}
                      disabled={followMutation.isPending || unfollowMutation.isPending}
                      className="rounded-lg w-full sm:w-auto"
                    >
                      {recipe.isFollowingSubmitter ? (
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
        )}

        {/* Comments Section */}
        <div className="container py-8 sm:py-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg sm:text-xl font-serif mb-4 sm:mb-6 flex items-center gap-3">
              <MessageCircle className="h-5 w-5" />
              Cooking Notes ({recipe.commentCount})
            </h2>

            {/* Comment Form */}
            {isAuthenticated ? (
              <form onSubmit={handleComment} className="mb-6 sm:mb-8">
                <Textarea
                  placeholder={`Leave a note for ${recipe.originalCookName}... (e.g., "Auntie, I tried this!")`}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="mb-3 rounded-lg resize-none text-sm sm:text-base"
                />
                <Button 
                  type="submit" 
                  disabled={!comment.trim() || commentMutation.isPending}
                  className="rounded-lg"
                >
                  {commentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Post Note
                </Button>
              </form>
            ) : (
              <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-muted text-center rounded-lg">
                <p className="text-sm sm:text-base text-muted-foreground mb-3">Sign in to leave a cooking note</p>
                <a href={getLoginUrl()}>
                  <Button size="sm" className="rounded-lg">Log In</Button>
                </a>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-0">
              {comments && comments.length > 0 ? (
                comments.map(({ comment: c, user: commentUser }) => (
                  <div key={c.id} className="py-4 sm:py-6 border-b border-border">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <Link href={`/book/${commentUser.id}`}>
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 bg-primary text-primary-foreground">
                          <AvatarImage src={commentUser.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                            {getInitials(commentUser.name)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Link href={`/book/${commentUser.id}`} className="font-medium text-sm sm:text-base hover:underline">
                            {commentUser.name || 'Anonymous'}
                          </Link>
                          <span className="text-[10px] sm:text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString('en-SG', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{c.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 sm:py-12 text-muted-foreground">
                  <MessageCircle className="h-10 sm:h-12 w-10 sm:w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm sm:text-base">No cooking notes yet. Be the first to share your experience!</p>
                </div>
              )}
            </div>
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
