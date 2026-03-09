import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ChefHat, Sparkles, Check, Share2, BookOpen, Loader2, Eye, EyeOff, Search, Menu, X, Plus, Lock, Pencil, Lightbulb, ChevronDown, ChevronUp, Copy, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

// 6-step onboarding flow
type Step = 1 | 2 | 3 | 4 | 5 | 6;

// Recipe source options for Step 2
const RECIPE_SOURCES = [
  { value: "mum", label: "My mum", defaultName: "Mum" },
  { value: "grandma", label: "My grandma", defaultName: "Ah Ma" },
  { value: "dad", label: "My dad", defaultName: "Dad" },
  { value: "family", label: "Another family member", defaultName: "" },
  { value: "myself", label: "Myself", defaultName: "" },
];

// Occasion options for Step 4
const OCCASION_OPTIONS = [
  { value: "everyday", label: "Everyday" },
  { value: "special", label: "Special occasions" },
  { value: "festive", label: "Festive / holidays" },
];

interface TidiedRecipe {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number | null;
  category: string;
  cuisineType: string;
  difficulty: "easy" | "medium" | "hard";
  tips: string;
  tags: string[];
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function SubmitRecipe() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Current step (1-6)
  const [step, setStep] = useState<Step>(1);
  
  // Step 2: Who is this recipe from
  const [recipeSource, setRecipeSource] = useState("");
  const [cookName, setCookName] = useState("");
  const [cookLocation, setCookLocation] = useState("");
  
  // Step 3: Recipe content
  const [dishName, setDishName] = useState("");
  const [messyIngredients, setMessyIngredients] = useState("");
  const [messyInstructions, setMessyInstructions] = useState("");
  
  // Step 4: Optional context
  const [occasion, setOccasion] = useState("");
  const [tips, setTips] = useState("");
  
  // Step 5: AI Tidy Preview
  const [tidiedRecipe, setTidiedRecipe] = useState<TidiedRecipe | null>(null);
  const [editedRecipe, setEditedRecipe] = useState<TidiedRecipe | null>(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [trustConfirmed, setTrustConfirmed] = useState(false);
  const [showTips, setShowTips] = useState(false);
  
  // Step 6: Published recipe
  const [createdRecipeSlug, setCreatedRecipeSlug] = useState("");
  
  // API mutations
  const tidyMutation = trpc.recipe.tidyRecipe.useMutation();
  const createMutation = trpc.recipe.create.useMutation();
  
  // Set initial step based on auth status
  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated) {
        setStep(2);
      } else {
        setStep(1);
      }
    }
  }, [authLoading, isAuthenticated]);
  
  // Get display name for the cook
  const getDisplayCookName = () => {
    if (recipeSource === "myself") return user?.name || "Me";
    return cookName || RECIPE_SOURCES.find(s => s.value === recipeSource)?.defaultName || "";
  };
  
  // Get relationship text
  const getRelationshipText = () => {
    if (recipeSource === "myself") return "";
    const source = RECIPE_SOURCES.find(s => s.value === recipeSource);
    if (source && recipeSource !== "family") {
      return source.label.replace("My ", "").toLowerCase();
    }
    return cookName ? "family member" : "";
  };
  
  // Handle AI tidy (Step 4 -> Step 5)
  // Client-side validation helpers
  const validateRecipeInput = () => {
    // Placeholder patterns to block
    const placeholderPatterns = [
      /^blah\s*blah?$/i,
      /^test(ing)?$/i,
      /^asdf+$/i,
      /^lorem\s*ipsum/i,
      /^xxx+$/i,
      /^abc+$/i,
      /^123+$/,
      /^sample$/i,
      /^placeholder$/i,
      /^example$/i,
      /^foo\s*bar?$/i,
      /^qwerty$/i,
    ];
    
    const containsPlaceholder = (text: string): boolean => {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      return lines.some(line => 
        placeholderPatterns.some(pattern => pattern.test(line))
      );
    };
    
    // Check ingredients
    const ingredientLines = messyIngredients.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (ingredientLines.length < 2) {
      return "Please provide at least 2 ingredients, each on a separate line.";
    }
    
    if (containsPlaceholder(messyIngredients)) {
      return "Please replace placeholder text with actual ingredients.";
    }
    
    // Check instructions
    const instructionParts = messyInstructions.split(/[\n.!?]+/).map(l => l.trim()).filter(l => l.length > 0);
    if (instructionParts.length < 2) {
      return "Please provide at least 2 cooking steps or sentences.";
    }
    
    if (containsPlaceholder(messyInstructions)) {
      return "Please replace placeholder text with actual cooking instructions.";
    }
    
    return null; // Valid
  };
  
  const handleTidy = async () => {
    if (!dishName.trim() || !messyIngredients.trim() || !messyInstructions.trim()) {
      toast.error("Please fill in the dish name, ingredients, and instructions");
      return;
    }
    
    // Validate input before sending to LLM
    const validationError = validateRecipeInput();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    
    try {
      const result = await tidyMutation.mutateAsync({
        recipeName: dishName,
        ingredients: messyIngredients,
        instructions: messyInstructions,
        tips,
        style: "structured",
      });
      
      setTidiedRecipe(result);
      setEditedRecipe(result);
      setStep(5);
    } catch (error: any) {
      // Show the server validation error message if available
      const message = error?.message || "Failed to process recipe. Please try again.";
      toast.error(message);
    }
  };
  
  // Handle publish (Step 5 -> Step 6)
  const handlePublish = async () => {
    if (!editedRecipe || !trustConfirmed) {
      toast.error("Please confirm the checkbox before publishing");
      return;
    }
    
    try {
      const result = await createMutation.mutateAsync({
        title: editedRecipe.title || dishName,
        description: editedRecipe.description,
        originalCookName: getDisplayCookName(),
        originalCookLocation: cookLocation || undefined,
        relationshipToSubmitter: getRelationshipText() || undefined,
        ingredients: editedRecipe.ingredients,
        instructions: editedRecipe.instructions,
        prepTimeMinutes: editedRecipe.prepTimeMinutes ?? undefined,
        cookTimeMinutes: editedRecipe.cookTimeMinutes ?? undefined,
        servings: editedRecipe.servings ?? undefined,
        category: editedRecipe.category,
        cuisineType: editedRecipe.cuisineType,
        difficulty: editedRecipe.difficulty,
        tips: editedRecipe.tips || tips,
        displayStyle: "structured",
        originalIngredients: messyIngredients,
        originalInstructions: messyInstructions,
      });
      
      setCreatedRecipeSlug(result.slug);
      setStep(6);
    } catch (error) {
      toast.error("Failed to publish recipe. Please try again.");
    }
  };
  
  // Get the viral share message
  const getShareMessage = () => {
    const cookDisplay = getDisplayCookName();
    return `This is the recipe for my ${cookDisplay}'s ${dishName} 👉\nCheck it out on sgrecipebook.com/recipe/${createdRecipeSlug}`;
  };

  // WhatsApp share URL
  const getWhatsAppShareUrl = () => {
    return `https://wa.me/?text=${encodeURIComponent(getShareMessage())}`;
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    const message = getShareMessage();
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Copied! Paste in WhatsApp or anywhere 📋");
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = message;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Copied! Paste in WhatsApp or anywhere 📋");
    }
  };
  
  // Reset form for adding another recipe
  const resetForm = () => {
    setStep(2);
    setRecipeSource("");
    setCookName("");
    setCookLocation("");
    setDishName("");
    setMessyIngredients("");
    setMessyInstructions("");
    setOccasion("");
    setTips("");
    setTidiedRecipe(null);
    setEditedRecipe(null);
    setTrustConfirmed(false);
    setCreatedRecipeSlug("");
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header user={user} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      
      <main className={`container max-w-2xl pt-16 sm:pt-12 pb-8 sm:pb-12 px-4 ${step === 5 ? 'pb-24' : ''}`}>
        {/* Progress indicator (show for steps 2-5) */}
        {step >= 2 && step <= 5 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[2, 3, 4, 5].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s ? "bg-primary text-white" : 
                  step > s ? "bg-green-500 text-white" : 
                  "bg-gray-200 text-gray-500"
                }`}>
                  {step > s ? <Check className="w-4 h-4" /> : s - 1}
                </div>
                {s < 5 && (
                  <div className={`w-8 sm:w-12 h-0.5 mx-1 ${step > s ? "bg-green-500" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Login */}
        {step === 1 && (
          <div className="text-center space-y-6 max-w-md mx-auto">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <ChefHat className="w-10 h-10 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900">
                Add My Mum's Recipe
              </h1>
              <p className="text-gray-600">
                Sign in to save and share your family's recipes
              </p>
            </div>
            
            <div className="space-y-3">
              <a href={getLoginUrl()} className="block">
                <Button variant="outline" size="lg" className="w-full rounded-xl h-12 justify-center gap-3">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
              </a>
              
              <a href={getLoginUrl()} className="block">
                <Button variant="outline" size="lg" className="w-full rounded-xl h-12 justify-center gap-3">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continue with Apple
                </Button>
              </a>
              
              <a href={getLoginUrl()} className="block">
                <Button variant="outline" size="lg" className="w-full rounded-xl h-12 justify-center gap-3">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Continue with Facebook
                </Button>
              </a>
            </div>
            
            <p className="text-xs text-gray-500 pt-4">
              We'll only use this to credit you for the recipe.<br />
              No spam. No ads.
            </p>
          </div>
        )}

        {/* Step 2: Who is this recipe from */}
        {step === 2 && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="text-center space-y-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900">
                Who is this recipe from?
              </h1>
              <p className="text-gray-600">
                Let's give credit where it's due
              </p>
            </div>
            
            <div className="space-y-3">
              {RECIPE_SOURCES.map((source) => (
                <label 
                  key={source.value}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    recipeSource === source.value 
                      ? "border-primary bg-primary/5" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="recipeSource"
                    value={source.value}
                    checked={recipeSource === source.value}
                    onChange={(e) => {
                      setRecipeSource(e.target.value);
                      if (source.defaultName) {
                        setCookName(source.defaultName);
                      } else if (source.value === "myself") {
                        setCookName(user?.name || "");
                      } else {
                        setCookName("");
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    recipeSource === source.value ? "border-primary" : "border-gray-300"
                  }`}>
                    {recipeSource === source.value && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="font-medium text-gray-900">{source.label}</span>
                </label>
              ))}
            </div>
            
            {recipeSource && recipeSource !== "myself" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <Label>What should we call them?</Label>
                  <Input
                    value={cookName}
                    onChange={(e) => setCookName(e.target.value)}
                    placeholder="e.g. Mum, Ah Ma, Auntie May"
                    className="rounded-xl"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Where are they from? <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input
                    value={cookLocation}
                    onChange={(e) => setCookLocation(e.target.value)}
                    placeholder="e.g. Toa Payoh, Bedok"
                    className="rounded-xl"
                  />
                </div>
              </div>
            )}
            
            <Button 
              size="lg" 
              className="w-full rounded-xl h-12"
              disabled={!recipeSource || (recipeSource !== "myself" && !cookName)}
              onClick={() => setStep(3)}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 3: Add the recipe */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900">
                Add the recipe
              </h1>
              <p className="text-gray-600">
                Messy notes welcome — we'll help tidy it up
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Dish name <span className="text-primary">*</span></Label>
                <Input
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  placeholder="Chicken Curry, Bak Kut Teh, Laksa..."
                  className="rounded-xl text-lg h-12"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Ingredients <span className="text-primary">*</span></Label>
                <Textarea
                  value={messyIngredients}
                  onChange={(e) => setMessyIngredients(e.target.value)}
                  placeholder="2 onions, garlic, curry powder, agak agak water…"
                  className="min-h-[140px] rounded-xl"
                />
                <p className="text-xs text-gray-500">
                  "Agak agak" amounts are totally fine — we'll preserve them!
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Instructions <span className="text-primary">*</span></Label>
                <Textarea
                  value={messyInstructions}
                  onChange={(e) => setMessyInstructions(e.target.value)}
                  placeholder="Fry until fragrant, add chicken, simmer…"
                  className="min-h-[160px] rounded-xl"
                />
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Don't worry about format. We'll help tidy it up without changing your recipe.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-xl h-12"
                onClick={() => setStep(2)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                size="lg" 
                className="flex-1 rounded-xl h-12"
                disabled={!dishName || !messyIngredients || !messyInstructions}
                onClick={() => setStep(4)}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Optional context */}
        {step === 4 && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="text-center space-y-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900">
                A bit more context
              </h1>
              <p className="text-gray-600">
                Optional — skip if you prefer
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>When do you usually cook this?</Label>
                <div className="space-y-2">
                  {OCCASION_OPTIONS.map((opt) => (
                    <label 
                      key={opt.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        occasion === opt.value 
                          ? "border-primary bg-primary/5" 
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="occasion"
                        value={opt.value}
                        checked={occasion === opt.value}
                        onChange={(e) => setOccasion(e.target.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        occasion === opt.value ? "border-primary" : "border-gray-300"
                      }`}>
                        {occasion === opt.value && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>One tip or secret? <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Textarea
                  value={tips}
                  onChange={(e) => setTips(e.target.value)}
                  placeholder="e.g. The secret is to use dark soy sauce from the red bottle..."
                  className="min-h-[80px] rounded-xl"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-xl h-12"
                onClick={() => setStep(3)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                size="lg" 
                className="flex-1 rounded-xl h-12"
                onClick={handleTidy}
                disabled={tidyMutation.isPending}
              >
                {tidyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
            
            <button 
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              onClick={handleTidy}
              disabled={tidyMutation.isPending}
            >
              Skip this step →
            </button>
          </div>
        )}

        {/* Step 5: AI Tidy Preview */}
        {step === 5 && tidiedRecipe && editedRecipe && (
          <div className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] bg-[#fafafa] pt-4 sm:pt-6 pb-24">
            {/* Wide inner container */}
            <div className="w-[min(92vw,1600px)] mx-auto px-6">
              <div className="text-center space-y-1 mb-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-1">
                  <Sparkles className="h-4 w-4 text-green-600" />
                </div>
                <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900">
                  We've tidied this up
                </h1>
                <p className="text-gray-500 text-sm">
                  Without changing your recipe
                </p>
              </div>
            
              <div className={`grid gap-6 lg:gap-8 ${showOriginal ? "lg:grid-cols-[40%_60%]" : "lg:grid-cols-1 max-w-4xl mx-auto"}`}>
              {/* Original (locked) - Secondary styling */}
              {showOriginal && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                      <h2 className="text-sm font-medium text-gray-500">Original (Preserved)</h2>
                      <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Read-only</span>
                    </div>
                    <button
                      onClick={() => setShowOriginal(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="bg-gray-50/80 rounded-xl p-4 space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Ingredients</div>
                      <pre className="text-xs text-gray-500 whitespace-pre-wrap font-mono leading-relaxed">{messyIngredients}</pre>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Instructions</div>
                      <pre className="text-xs text-gray-500 whitespace-pre-wrap font-mono leading-relaxed">{messyInstructions}</pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Tidied (editable) - Primary styling */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-primary" />
                    <h2 className="font-semibold text-gray-900">Tidied Version</h2>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Editable</span>
                  </div>
                  {!showOriginal && (
                    <button
                      onClick={() => setShowOriginal(true)}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Show Original
                    </button>
                  )}
                </div>
                <div className="bg-white border-2 border-primary/30 rounded-2xl p-4 sm:p-6 space-y-6 shadow-sm">
                  {/* Title & Description */}
                  <div className="space-y-3">
                    <Input
                      value={editedRecipe.title}
                      onChange={(e) => setEditedRecipe({ ...editedRecipe, title: e.target.value })}
                      className="font-serif text-xl sm:text-2xl font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0"
                    />
                    <Textarea
                      value={editedRecipe.description}
                      onChange={(e) => setEditedRecipe({ ...editedRecipe, description: e.target.value })}
                      className="text-gray-600 border-0 resize-none px-0 focus-visible:ring-0"
                      placeholder="Short description (optional — you can leave this blank)"
                      rows={2}
                    />
                  </div>

                  {/* Metadata - Optional fields */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-3 sm:gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Prep:</span>
                        <Input
                          type="number"
                          value={editedRecipe.prepTimeMinutes || ""}
                          onChange={(e) => setEditedRecipe({ ...editedRecipe, prepTimeMinutes: parseInt(e.target.value) || null })}
                          className="w-14 sm:w-16 h-8 text-center rounded-lg"
                          placeholder="-"
                        />
                        <span className="text-gray-500">min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Cook:</span>
                        <Input
                          type="number"
                          value={editedRecipe.cookTimeMinutes || ""}
                          onChange={(e) => setEditedRecipe({ ...editedRecipe, cookTimeMinutes: parseInt(e.target.value) || null })}
                          className="w-14 sm:w-16 h-8 text-center rounded-lg"
                          placeholder="-"
                        />
                        <span className="text-gray-500">min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Serves:</span>
                        <Input
                          type="number"
                          value={editedRecipe.servings || ""}
                          onChange={(e) => setEditedRecipe({ ...editedRecipe, servings: parseInt(e.target.value) || null })}
                          className="w-14 sm:w-16 h-8 text-center rounded-lg"
                          placeholder="-"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 italic">Optional — leave blank if unsure</p>
                  </div>

                  {/* Ingredients */}
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Ingredients</div>
                    <Textarea
                      value={editedRecipe.ingredients.join('\n')}
                      onChange={(e) => {
                        const newIngredients = e.target.value.split('\n').filter(line => line.trim());
                        setEditedRecipe({ ...editedRecipe, ingredients: newIngredients.length > 0 ? newIngredients : [''] });
                      }}
                      className="w-full min-h-[200px] border rounded-lg p-3 font-mono text-sm leading-relaxed resize-y focus-visible:ring-primary"
                      placeholder="Enter each ingredient on a new line..."
                    />
                  </div>

                  {/* Instructions - Numbered Steps */}
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Instructions</div>
                    <div className="border rounded-lg p-3 bg-white space-y-3">
                      {editedRecipe.instructions.map((instruction, index) => (
                        <div key={index} className="flex gap-3 group">
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                            {index + 1}
                          </div>
                          <Textarea
                            value={instruction}
                            onChange={(e) => {
                              const newInstructions = [...editedRecipe.instructions];
                              newInstructions[index] = e.target.value;
                              setEditedRecipe({ ...editedRecipe, instructions: newInstructions });
                            }}
                            className="flex-1 min-h-[60px] border rounded-lg p-2 text-sm leading-relaxed resize-y focus-visible:ring-primary"
                            placeholder={`Step ${index + 1}...`}
                          />
                          {editedRecipe.instructions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newInstructions = editedRecipe.instructions.filter((_, i) => i !== index);
                                setEditedRecipe({ ...editedRecipe, instructions: newInstructions });
                              }}
                              className="flex-shrink-0 w-7 h-7 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                              title="Remove step"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditedRecipe({ ...editedRecipe, instructions: [...editedRecipe.instructions, ''] })}
                        className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors ml-10"
                      >
                        <Plus className="w-4 h-4" />
                        Add step
                      </button>
                    </div>
                  </div>

                  {/* Tips - Collapsible */}
                  {(editedRecipe.tips || tips) && (
                    <div className="bg-amber-50/70 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setShowTips(!showTips)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-amber-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-amber-700">
                          <Lightbulb className="w-4 h-4" />
                          <span className="text-sm">Our AI noticed something you may want to check</span>
                        </div>
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          {showTips ? (
                            <>
                              Hide <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              View note <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </span>
                      </button>
                      {showTips && (
                        <div className="px-3 pb-3">
                          <Textarea
                            value={editedRecipe.tips || tips}
                            onChange={(e) => setEditedRecipe({ ...editedRecipe, tips: e.target.value })}
                            className="bg-white/50 border-amber-200 resize-none focus-visible:ring-amber-300 text-amber-900 text-sm"
                            rows={2}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
            
          </div>
        )}
        
        {/* Sticky Footer - Confirmation (Step 5 only) */}
        {step === 5 && tidiedRecipe && editedRecipe && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={trustConfirmed}
                  onCheckedChange={(checked) => setTrustConfirmed(checked as boolean)}
                />
                <span className="text-sm text-gray-600">I understand the original recipe will always be preserved</span>
              </label>
              
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-500"
                  onClick={() => setStep(4)}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  size="default" 
                  className="rounded-lg"
                  disabled={!trustConfirmed || createMutation.isPending}
                  onClick={handlePublish}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    "Publish this recipe"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Celebrate */}
        {step === 6 && (
          <div className="text-center space-y-6 max-w-md mx-auto py-8">
            <div className="text-6xl">🎉</div>
            
            <div className="space-y-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900">
                Your family recipe is now saved!
              </h1>
              <p className="text-gray-600">
                This recipe is now part of your family's story.
              </p>
            </div>
            
            {/* Designed Recipe Cover Card */}
            <div className="rounded-2xl overflow-hidden shadow-lg">
              <div className="bg-gradient-to-br from-[#fef6f0] via-[#fff5f5] to-[#fef0f0] p-8 relative">
                {/* Subtle decorative elements */}
                <div className="absolute top-4 right-4 opacity-10">
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                </div>
                
                {/* Rice bowl icon */}
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-white/60 flex items-center justify-center shadow-sm">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-primary">
                      <path d="M12 4C7 4 3 7 3 10.5V11H21V10.5C21 7 17 4 12 4Z" fill="currentColor" opacity="0.2"/>
                      <path d="M3 11C3 11 3 15 6 17C8 18.5 10 19 12 19C14 19 16 18.5 18 17C21 15 21 11 21 11H3Z" fill="currentColor" opacity="0.3"/>
                      <path d="M12 4C7 4 3 7 3 10.5V11H21V10.5C21 7 17 4 12 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 11C3 11 3 15 6 17C8 18.5 10 19 12 19C14 19 16 18.5 18 17C21 15 21 11 21 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 19V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M8 22H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
                
                {/* Category badge */}
                {editedRecipe?.category && (
                  <div className="flex justify-center mb-3">
                    <span className="px-3 py-1 bg-white/70 text-primary text-xs font-medium rounded-full shadow-sm">
                      {editedRecipe.category}
                    </span>
                  </div>
                )}
                
                {/* Dish name - large and elegant */}
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  {editedRecipe?.title || dishName}
                </h3>
                
                {/* Attribution */}
                <p className="text-gray-600 text-sm mb-1">
                  {getDisplayCookName()}'s Family Recipe
                </p>
                
                {/* Preserved on SG Recipe Book */}
                <p className="text-gray-400 text-xs">
                  Preserved on SG Recipe Book
                </p>
              </div>
            </div>
            
            {/* Edit note */}
            <p className="text-gray-500 text-sm">
              You can edit this recipe anytime.
            </p>
            
            {/* Share Options */}
            <div className="space-y-3">
              {/* WhatsApp Share */}
              <a
                href={getWhatsAppShareUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button size="lg" className="w-full rounded-xl h-12 bg-[#25D366] hover:bg-[#20BD5A]">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Share on WhatsApp
                </Button>
              </a>
              
              {/* Copy Link */}
              <Button 
                size="lg" 
                variant="outline"
                className="w-full rounded-xl h-12"
                onClick={handleCopyLink}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy link to share
              </Button>
            </div>
            
            {/* Secondary CTAs - Text links */}
            <div className="flex justify-center gap-6 text-sm">
              <Link 
                href={`/book/${user?.id}`}
                className="text-gray-600 hover:text-primary transition-colors"
              >
                View recipe book
              </Link>
              <button
                onClick={resetForm}
                className="text-gray-600 hover:text-primary transition-colors"
              >
                Add another recipe
              </button>
            </div>
            
            {createdRecipeSlug && (
              <Link 
                href={`/recipe/${createdRecipeSlug}`}
                className="block text-sm text-primary hover:underline mt-4"
              >
                View your published recipe →
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

interface HeaderProps {
  user: { id: number; name: string | null } | null;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

function Header({ user, mobileMenuOpen, setMobileMenuOpen }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="container">
        <div className="flex items-center justify-between h-14 gap-4">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="font-serif text-xl">SG Recipe Book</span>
            <img src="/logo.svg" alt="SG Recipe Book" className="h-6 w-auto" />
          </Link>
          
          <div className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search home recipes..."
                className="w-full h-10 pl-4 pr-10 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/submit">
              <Button className="bg-primary hover:shadow-lg hover:-translate-y-0.5 transition-all rounded-full">
                Add My Mum's Recipe
              </Button>
            </Link>
            {user && (
              <Link href={`/book/${user.id}`}>
                <div className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {getInitials(user.name)}
                </div>
              </Link>
            )}
          </div>

          <button 
            className="sm:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        
        {mobileMenuOpen && (
          <div className="sm:hidden py-4 border-t border-gray-100 space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search home recipes..."
                className="w-full h-10 pl-4 pr-10 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/recipes" className="py-2 text-gray-600" onClick={() => setMobileMenuOpen(false)}>
                Browse Recipes
              </Link>
              {user && (
                <Link href={`/book/${user.id}`} className="py-2 flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {getInitials(user.name)}
                  </div>
                  <span>{user.name || 'Profile'}</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
