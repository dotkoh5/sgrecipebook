import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";

// Helper to generate URL-friendly slugs
function generateSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return `${baseSlug}-${nanoid(6)}`;
}

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Recipe routes
  recipe: router({
    // Get all recipes with pagination and sorting
    list: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        sortBy: z.enum(['recent', 'popular', 'mostLiked']).default('recent'),
        category: z.string().optional(),
        cuisineType: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const options = input ?? {};
        const recipesWithLikes = await db.getRecipesWithLikes(options);
        
        // Get submitter info for each recipe
        const results = await Promise.all(
          recipesWithLikes.map(async ({ recipe, likeCount }) => {
            const submitter = await db.getUserById(recipe.submittedById);
            const commentCount = await db.getCommentCount(recipe.id);
            return {
              ...recipe,
              likeCount,
              commentCount,
              submitter: submitter ? { id: submitter.id, name: submitter.name, avatarUrl: submitter.avatarUrl } : null,
            };
          })
        );

        // If user is logged in, get their liked recipe IDs
        let userLikedIds: number[] = [];
        if (ctx.user) {
          userLikedIds = await db.getUserLikedRecipeIds(ctx.user.id, results.map(r => r.id));
        }

        return results.map(r => ({
          ...r,
          isLiked: userLikedIds.includes(r.id),
        }));
      }),

    // Get single recipe by slug
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input, ctx }) => {
        const recipe = await db.getRecipeBySlug(input.slug);
        if (!recipe) return null;

        // Increment view count
        await db.incrementRecipeViews(recipe.id);

        const submitter = await db.getUserById(recipe.submittedById);
        const likeCount = await db.getRecipeLikeCount(recipe.id);
        const commentCount = await db.getCommentCount(recipe.id);
        
        let isLiked = false;
        let isFollowingSubmitter = false;
        if (ctx.user) {
          isLiked = await db.hasLikedRecipe(ctx.user.id, recipe.id);
          if (submitter) {
            isFollowingSubmitter = await db.isFollowing(ctx.user.id, submitter.id);
          }
        }

        return {
          ...recipe,
          likeCount,
          commentCount,
          isLiked,
          submitter: submitter ? {
            id: submitter.id,
            name: submitter.name,
            avatarUrl: submitter.avatarUrl,
            bio: submitter.bio,
            location: submitter.location,
          } : null,
          isFollowingSubmitter,
        };
      }),

    // AI-powered recipe tidying
    tidyRecipe: protectedProcedure
      .input(z.object({
        recipeName: z.string().min(1),
        ingredients: z.string().min(1),
        instructions: z.string().min(1),
        tips: z.string().optional(),
        style: z.enum(['auntie', 'structured']).default('structured'),
      }))
      .mutation(async ({ input }) => {
        // ========== INPUT VALIDATION TO PREVENT LLM HALLUCINATION ==========
        
        // Obvious placeholder patterns to block
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
        
        // Check if text contains placeholder content
        const containsPlaceholder = (text: string): boolean => {
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          return lines.some(line => 
            placeholderPatterns.some(pattern => pattern.test(line))
          );
        };
        
        // Check if a line contains at least one real word (3+ chars, not just numbers/symbols)
        const hasRealWord = (line: string): boolean => {
          const words = line.split(/\s+/);
          return words.some(word => /^[a-zA-Z]{3,}/.test(word));
        };
        
        // Common food-related words to detect recipe content
        const foodWords = /\b(chicken|pork|beef|fish|rice|noodle|egg|onion|garlic|ginger|salt|sugar|oil|water|sauce|soy|pepper|flour|butter|milk|cream|vegetable|carrot|potato|tomato|chilli|spice|meat|cook|fry|boil|steam|bake|stir|mix|add|cut|slice|chop|minute|hour|cup|tablespoon|teaspoon|gram|kg|ml|piece|clove)s?\b/i;
        
        // Validate ingredients field
        const ingredientLines = input.ingredients.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        if (ingredientLines.length < 2) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Please provide at least 2 ingredients. Each ingredient should be on a separate line.',
          });
        }
        
        const ingredientLinesWithRealWords = ingredientLines.filter(hasRealWord);
        if (ingredientLinesWithRealWords.length < 2) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Please provide real ingredient names. Each line should contain at least one word.',
          });
        }
        
        // Check if at least one line has food-related content
        const hasFoodContent = ingredientLines.some(line => foodWords.test(line) || /\d/.test(line));
        if (!hasFoodContent) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Please provide actual recipe ingredients with quantities or food items.',
          });
        }
        
        if (containsPlaceholder(input.ingredients)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Please replace placeholder text with actual ingredients.',
          });
        }
        
        // Validate instructions field
        const instructionLines = input.instructions.split(/[\n.!?]+/).map(l => l.trim()).filter(l => l.length > 0);
        
        if (instructionLines.length < 2) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Please provide at least 2 cooking steps or sentences.',
          });
        }
        
        const shortLines = instructionLines.filter(line => line.length < 5);
        if (shortLines.length > instructionLines.length / 2) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Instructions seem too short. Please provide more detailed cooking steps.',
          });
        }
        
        if (containsPlaceholder(input.instructions)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Please replace placeholder text with actual cooking instructions.',
          });
        }
        
        // ========== END INPUT VALIDATION ==========
        
        // Pre-normalizer: combine fragmented lines that belong together
        // CONSERVATIVE Pre-Normalizer
        // Only merges single-token meat-part vocabulary
        // Errs on "leave it broken, let the LLM decide"
        const preNormalize = (text: string): string => {
          const lines = text.split('\n');
          const normalized: string[] = [];
          
          // Known meat-part vocabulary (single tokens only)
          const meatParts = new Set([
            'breast', 'breasts', 'thigh', 'thighs', 'wing', 'wings',
            'drumstick', 'drumsticks', 'leg', 'legs', 'rib', 'ribs',
            'loin', 'tenderloin', 'shoulder', 'belly', 'neck',
            'liver', 'gizzard', 'heart', 'kidney'
          ]);
          
          // Ingredient keywords - NEVER merge lines containing these
          const ingredientKeywords = /\b(milk|sauce|paste|powder|oil|butter|cream|flour|sugar|salt|pepper|vinegar|water|stock|broth|juice|extract|essence)\b/i;
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const words = line.split(/\s+/);
            const wordCount = words.length;
            const lineLower = line.toLowerCase();
            
            // HARD STOPS - never merge if:
            // 1. Line has more than 2 words
            // 2. Line contains ingredient keywords
            // 3. Line looks like a brand (capitalised multi-word)
            const hasMoreThan2Words = wordCount > 2;
            const hasIngredientKeyword = ingredientKeywords.test(line);
            const looksLikeBrand = wordCount >= 2 && /^[A-Z]/.test(line) && /[A-Z]/.test(words[1] || '');
            
            if (hasMoreThan2Words || hasIngredientKeyword || looksLikeBrand) {
              normalized.push(line);
              continue;
            }
            
            // ONLY merge if:
            // 1. Single word (or 2 words max)
            // 2. Word is in meat-part vocabulary
            // 3. Previous line suggests continuation (ends with meat context)
            const isSingleMeatPart = wordCount === 1 && meatParts.has(lineLower);
            
            if (normalized.length > 0 && isSingleMeatPart) {
              const prevLine = normalized[normalized.length - 1];
              // Only merge if previous line mentions chicken/meat context
              const prevHasMeatContext = /\b(chicken|pork|beef|lamb|duck|turkey|meat|cut|broken|have|thighs?)\b/i.test(prevLine);
              
              if (prevHasMeatContext) {
                // Merge with previous line
                normalized[normalized.length - 1] = prevLine + ', ' + line;
                continue;
              }
            }
            
            // Default: leave it as is, let the LLM decide
            normalized.push(line);
          }
          
          return normalized.join('\n');
        };

        // Apply pre-normalization to ingredients and instructions
        const normalizedIngredients = preNormalize(input.ingredients);
        const normalizedInstructions = preNormalize(input.instructions);

        // System prompt - concise role definition with hallucination protection
        const systemPrompt = `You are a careful editor, NOT a recipe creator.

CRITICAL RULES:
- You are helping tidy home recipes written by family members.
- You improve readability and structure without changing meaning.
- You are NOT a chef and must NOT invent or create recipes.
- If the input contains placeholder text, nonsense, or insufficient information (e.g. "blah blah", "test", "asdf", or meaningless content), you must return minimal output with empty arrays.
- You must NEVER invent ingredients, steps, cooking times, cuisine names, or dish descriptions.
- If information is missing, leave it blank or use the original input.
- Do not infer dish names or cuisines - only use what is explicitly provided.
- When in doubt, preserve the original text rather than making assumptions.`;

        // User prompt - full instructions + structured input
        const userPrompt = `TASK

You are tidying a home recipe for readability. You must not add, remove, substitute, or optimise any ingredients, quantities, steps, timing, or techniques.

Given:
- A list of ingredients (possibly unstructured)
- A list of instructions (possibly fragmented or written as continuous text)

Produce a tidied version that:
1. Groups related ingredients with section headers when the recipe has distinct components (paste, sauce, main dish, garnish, etc.)
2. Standardises each ingredient line into a clean format
3. Combines fragmented instruction sentences into coherent numbered steps
4. Keeps the original cooking order and meaning
5. Preserves informal quantities (e.g. "some", "agak agak") and brand names exactly
6. Uses simple, home-style language

INGREDIENT FORMATTING — CRITICAL:
Each ingredient line must follow this format:
  "{quantity} {ingredient} ({preparation if any})"
Examples:
  "20 cloves garlic"
  "10 small onions"
  "1 ginger (sliced and juiced)"
  "6–8 large potatoes (peeled and halved)"
  "1 whole chicken (broken down into thighs, breast, and wings)"
  "1 tbsp Kikkoman light soy sauce"
  "1 packet fresh coconut milk"
  "Olive oil (for frying)"

SECTION HEADERS for ingredient groups:
- MUST start with "For the " and end with ":"
- MUST be on their own line, separate from any ingredient
- NEVER combine a section header with an ingredient on the same line
- Use headers when the recipe has clearly distinct components (e.g. a paste/rempah, a sauce, a main protein, a garnish)
Examples of CORRECT headers:
  "For the Curry Paste:"
  "For the Curry:"
  "For the Garnish:"
  "For the Rice:"
  "For the Broth:"
  "For the Sambal:"

BAD — DO NOT do this:
  "Curry Paste – 20 cloves garlic"  ← header merged with ingredient!
  "Curry – 1 ginger"               ← header merged with ingredient!

GOOD:
  "For the Curry Paste:"
  "20 cloves garlic"
  "10 small onions"
  "3 stalks lemongrass"
  "1 ginger (sliced and juiced)"
  "For the Curry:"
  "6–8 large potatoes (peeled and halved)"
  "1 whole chicken (broken down into thighs, breast, and wings)"

LINE RECOMBINATION for ingredients:
When input has fragmented lines (e.g. "breast" or "and wings" alone), merge them into the preceding ingredient.
E.g. "1 chicken (broken down into thighs\nbreast\nand wings)" → "1 whole chicken (broken down into thighs, breast, and wings)"

INSTRUCTION FORMATTING — CRITICAL:
- Combine related sentences into coherent PARAGRAPHS, not individual sentences
- Each instruction array item should be a COMPLETE STEP that may contain multiple sentences
- Group sentences that describe the same cooking action together
- A step like "making the curry paste" should be ONE array item with multiple sentences explaining the full process
- Aim for 5–12 instruction steps total, NOT 20–50 fragmented lines
- Each step should describe a meaningful cooking milestone

EXAMPLE of good instruction formatting:
BAD (too fragmented):
["Wash the chicken.", "Remember to set aside the fat.", "Transfer to a plate.", "Pat dry with paper towel."]

GOOD (coherent steps):
["Wash the chicken and set aside the chicken fat from the cavity. Transfer to a plate and pat dry with a paper towel."]

INPUT:

Recipe Name: ${input.recipeName}

Ingredients:
${normalizedIngredients}

Instructions:
${normalizedInstructions}

${input.tips ? `Tips: ${input.tips}` : ''}

OUTPUT FORMAT:
{
  "title": "...",
  "description": "a brief 1-2 sentence description of this dish",
  "meta": {
    "prep_minutes": null,
    "cook_minutes": null,
    "servings": null,
    "category": "Main Dish or Side Dish or Soup or Dessert or Snack or Breakfast or Beverage or Condiment",
    "cuisine_type": "Chinese or Malay or Indian or Peranakan or Eurasian or Others",
    "difficulty": "easy or medium or hard"
  },
  "ingredients": [
    "For the Curry Paste:",
    "20 cloves garlic",
    "10 small onions",
    "3 stalks lemongrass",
    "1 ginger (sliced and juiced)",
    "For the Curry:",
    "6–8 large potatoes (peeled and halved)",
    "1 whole chicken (broken down into thighs, breast, and wings)",
    "Curry powder (or Prima Paste)",
    "1 tbsp Kikkoman light soy sauce",
    "1 tbsp tamari soy sauce",
    "1 packet fresh coconut milk",
    "2 tomatoes (quartered)",
    "200 ml water",
    "Olive oil (for frying)"
  ],
  "instructions": [
    "Prepare the curry paste by blending the garlic, onions, lemongrass, and ginger together until smooth. Set aside.",
    "Heat olive oil in a large pot over medium heat. Fry the curry paste until fragrant and the oil separates, about 5–8 minutes.",
    "..."
  ],
  "tips": "...",
  "tags": ["..."]
}

RULES:
- Section headers MUST start with "For the " and end with ":" — never merge with an ingredient
- Each ingredient must be a single clean line with quantity, item, and preparation
- Each instruction must be a COMPLETE STEP with multiple sentences describing that cooking phase
- Aim for 5–12 instruction steps, NOT 20–50 fragmented sentences
- Do not add, remove, or infer any content — only reorganise and reformat
- Output JSON only. No explanation.`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.1,
            top_p: 0.9,
            max_tokens: 2500,
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'tidied_recipe',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    meta: {
                      type: 'object',
                      properties: {
                        prep_minutes: { type: 'number' },
                        cook_minutes: { type: 'number' },
                        servings: { type: 'number' },
                        category: { type: 'string' },
                        cuisine_type: { type: 'string' },
                        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }
                      },
                      required: ['prep_minutes', 'cook_minutes', 'servings', 'category', 'cuisine_type', 'difficulty'],
                      additionalProperties: false
                    },
                    ingredients: { type: 'array', items: { type: 'string' } },
                    instructions: { type: 'array', items: { type: 'string' } },
                    tips: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['title', 'description', 'meta', 'ingredients', 'instructions', 'tips', 'tags'],
                  additionalProperties: false
                }
              }
            }
          });

          console.log('[TidyRecipe] Full LLM response:', JSON.stringify(response).substring(0, 1000));
          const content = response.choices?.[0]?.message?.content;
          console.log('[TidyRecipe] LLM response content type:', typeof content);
          if (!content) throw new Error('No response from AI');
          
          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          console.log('[TidyRecipe] Parsing JSON...');
          const parsed = JSON.parse(contentStr);
          console.log('[TidyRecipe] Parsed successfully, ingredients count:', parsed.ingredients?.length, 'instructions count:', parsed.instructions?.length);
          // Extract values from the new meta structure
          const meta = parsed.meta || {};
          return {
            title: parsed.title || input.recipeName,
            description: parsed.description || '',
            ingredients: parsed.ingredients || [],
            instructions: parsed.instructions || [],
            prepTimeMinutes: meta.prep_minutes,
            cookTimeMinutes: meta.cook_minutes,
            servings: meta.servings,
            category: meta.category || 'Main Dish',
            cuisineType: meta.cuisine_type || 'Chinese',
            difficulty: meta.difficulty || 'medium',
            tips: parsed.tips || '',
            tags: parsed.tags || [],
          };
        } catch (error) {
          console.error('AI tidying failed:', error);
          // Fallback: return basic structured version
          return {
            title: input.recipeName,
            description: '',
            ingredients: input.ingredients.split(/[,\n]+/).map(i => i.trim()).filter(Boolean),
            instructions: input.instructions.split(/[.\n]+/).map(i => i.trim()).filter(Boolean),
            prepTimeMinutes: null,
            cookTimeMinutes: null,
            servings: null,
            category: 'Main Dish',
            cuisineType: 'Chinese',
            difficulty: 'medium' as const,
            tips: input.tips || '',
            tags: [],
          };
        }
      }),

    // Create new recipe
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(256),
        description: z.string().optional(),
        originalCookName: z.string().min(1).max(128),
        originalCookLocation: z.string().max(128).optional(),
        relationshipToSubmitter: z.string().max(128).optional(),
        ingredients: z.array(z.string()).min(1),
        instructions: z.array(z.string()).min(1),
        prepTimeMinutes: z.number().min(0).optional(),
        cookTimeMinutes: z.number().min(0).optional(),
        servings: z.number().min(1).optional(),
        imageUrl: z.string().optional(),
        additionalImages: z.array(z.string()).optional(),
        category: z.string().optional(),
        cuisineType: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        tips: z.string().optional(),
        // New fields for preserving original input
        displayStyle: z.enum(['auntie', 'structured']).optional(),
        originalIngredients: z.string().optional(),
        originalInstructions: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const slug = generateSlug(input.title);
        const shortCode = nanoid(6); // Generate 6-character short code for sharing
        
        // Generate AI image for the recipe if no image provided
        let imageUrl = input.imageUrl;
        let imageError: string | null = null;
        if (!imageUrl) {
          try {
            const cuisineContext = input.cuisineType ? `${input.cuisineType} ` : 'Singaporean ';
            const prompt = `Professional food photography of ${cuisineContext}${input.title}, home-cooked style, appetizing presentation on a plate, warm lighting, shallow depth of field, top-down angle, clean background`;
            console.log('[RecipeCreate] Generating image for:', input.title);
            const result = await generateImage({ prompt });
            imageUrl = result.url;
            console.log('[RecipeCreate] Image generated:', imageUrl?.substring(0, 80));
          } catch (error) {
            imageError = error instanceof Error ? error.message : String(error);
            console.error('[RecipeCreate] Image generation failed:', imageError);
            // Continue without image if generation fails
          }
        }

        const recipeId = await db.createRecipe({
          ...input,
          imageUrl,
          slug,
          shortCode,
          submittedById: ctx.user.id,
          isPublished: true,
          isSeeded: false,
        });

        // Mark onboarding as complete after first recipe submission
        if (!ctx.user.hasCompletedOnboarding) {
          await db.markOnboardingComplete(ctx.user.id);
        }

        return { id: recipeId, slug, shortCode, imageError };
      }),

    // Update recipe (owner only)
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(256).optional(),
        description: z.string().optional(),
        originalCookName: z.string().min(1).max(128).optional(),
        originalCookLocation: z.string().max(128).optional(),
        relationshipToSubmitter: z.string().max(128).optional(),
        ingredients: z.array(z.string()).optional(),
        instructions: z.array(z.string()).optional(),
        prepTimeMinutes: z.number().min(0).optional(),
        cookTimeMinutes: z.number().min(0).optional(),
        servings: z.number().min(1).optional(),
        imageUrl: z.string().optional(),
        additionalImages: z.array(z.string()).optional(),
        category: z.string().optional(),
        cuisineType: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        tips: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const recipe = await db.getRecipeById(input.id);
        if (!recipe) throw new Error("Recipe not found");
        if (recipe.submittedById !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new Error("Not authorized to edit this recipe");
        }
        
        const { id, ...updateData } = input;
        await db.updateRecipe(id, updateData);
        return { success: true };
      }),

    // Regenerate image for a recipe (owner only)
    regenerateImage: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const recipe = await db.getRecipeById(input.id);
        if (!recipe) throw new Error("Recipe not found");
        if (recipe.submittedById !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new Error("Not authorized to edit this recipe");
        }
        
        const cuisineContext = recipe.cuisineType ? `${recipe.cuisineType} ` : 'Singaporean ';
        const prompt = `Professional food photography of ${cuisineContext}${recipe.title}, home-cooked style, appetizing presentation on a plate, warm lighting, shallow depth of field, top-down angle, clean background`;
        const result = await generateImage({ prompt });
        
        if (result.url) {
          await db.updateRecipe(input.id, { imageUrl: result.url });
          return { success: true, imageUrl: result.url };
        }
        throw new Error("Failed to generate image");
      }),

    // Delete recipe (owner only)
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const recipe = await db.getRecipeById(input.id);
        if (!recipe) throw new Error("Recipe not found");
        if (recipe.submittedById !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new Error("Not authorized to delete this recipe");
        }
        
        await db.deleteRecipe(input.id);
        return { success: true };
      }),

    // Get recipes by user
    getByUser: publicProcedure
      .input(z.object({ userId: z.number(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return db.getRecipes({ userId: input.userId, limit: input.limit });
      }),

    // Get total recipe count
    count: publicProcedure.query(async () => {
      return db.getRecipeCount();
    }),
  }),

  // Social features
  social: router({
    // Like a recipe
    like: protectedProcedure
      .input(z.object({ recipeId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.likeRecipe(ctx.user.id, input.recipeId);
        return { success: true };
      }),

    // Unlike a recipe
    unlike: protectedProcedure
      .input(z.object({ recipeId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.unlikeRecipe(ctx.user.id, input.recipeId);
        return { success: true };
      }),

    // Follow a user
    follow: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id) {
          throw new Error("Cannot follow yourself");
        }
        await db.followUser(ctx.user.id, input.userId);
        return { success: true };
      }),

    // Unfollow a user
    unfollow: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.unfollowUser(ctx.user.id, input.userId);
        return { success: true };
      }),

    // Check if following
    isFollowing: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input, ctx }) => {
        return db.isFollowing(ctx.user.id, input.userId);
      }),
  }),

  // Comments
  comment: router({
    // Get comments for a recipe
    list: publicProcedure
      .input(z.object({ recipeId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getCommentsByRecipeId(input.recipeId, input.limit);
      }),

    // Add a comment
    create: protectedProcedure
      .input(z.object({
        recipeId: z.number(),
        content: z.string().min(1).max(2000),
        parentId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const commentId = await db.createComment({
          userId: ctx.user.id,
          recipeId: input.recipeId,
          content: input.content,
          parentId: input.parentId,
        });
        return { id: commentId };
      }),

    // Delete a comment
    delete: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteComment(input.commentId, ctx.user.id);
        return { success: true };
      }),
  }),

  // User profile
  user: router({
    // Get user profile by ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const user = await db.getUserById(input.id);
        if (!user) return null;

        const followerCount = await db.getFollowerCount(user.id);
        const followingCount = await db.getFollowingCount(user.id);
        const recipes = await db.getRecipes({ userId: user.id, limit: 100 });

        let isFollowing = false;
        if (ctx.user && ctx.user.id !== user.id) {
          isFollowing = await db.isFollowing(ctx.user.id, user.id);
        }

        return {
          id: user.id,
          name: user.name,
          bio: user.bio,
          location: user.location,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          followerCount,
          followingCount,
          recipeCount: recipes.length,
          isFollowing,
          isOwnProfile: ctx.user?.id === user.id,
        };
      }),

    // Update own profile
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100).optional(),
        bio: z.string().max(500).optional(),
        location: z.string().max(128).optional(),
        avatarUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),

    // Get followers
    getFollowers: publicProcedure
      .input(z.object({ userId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getFollowers(input.userId, input.limit);
      }),

    // Get following
    getFollowing: publicProcedure
      .input(z.object({ userId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getFollowing(input.userId, input.limit);
      }),
  }),

  // Analytics routes (admin only)
  analytics: router({
    // Get analytics stats
    getStats: protectedProcedure
      .input(z.object({
        period: z.enum(['day', 'week', 'month']).default('day'),
      }))
      .query(async ({ input, ctx }) => {
        // Only allow admin users
        if (ctx.user.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }
        return db.getAnalyticsStats(input.period);
      }),

    // Get recent signups
    getRecentSignups: protectedProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }
        return db.getRecentSignups(input.limit);
      }),

    // Get recent recipes
    getRecentRecipes: protectedProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }
        return db.getRecentRecipes(input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
