import { eq, desc, asc, and, sql, count, inArray, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, recipes, followers, likes, comments, InsertRecipe, InsertComment } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER QUERIES ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    // New users should have hasCompletedOnboarding = true by default
    // (We don't want to force them through onboarding - they can submit recipes anytime)
    values.hasCompletedOnboarding = true;

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, data: { name?: string; bio?: string; location?: string; avatarUrl?: string }) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function markOnboardingComplete(userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ hasCompletedOnboarding: true }).where(eq(users.id, userId));
}

// ==================== RECIPE QUERIES ====================

export async function createRecipe(recipe: InsertRecipe) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(recipes).values(recipe);
  return result[0].insertId;
}

export async function getRecipeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecipeBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(recipes).where(eq(recipes.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecipeByShortCode(shortCode: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(recipes).where(eq(recipes.shortCode, shortCode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecipes(options: {
  limit?: number;
  offset?: number;
  sortBy?: 'recent' | 'popular' | 'mostLiked';
  category?: string;
  cuisineType?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const { limit = 20, offset = 0, sortBy = 'recent', category, cuisineType, userId } = options;

  // Build conditions array
  const conditions = [eq(recipes.isPublished, true)];
  if (category) conditions.push(eq(recipes.category, category));
  if (cuisineType) conditions.push(eq(recipes.cuisineType, cuisineType));
  if (userId) conditions.push(eq(recipes.submittedById, userId));

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  return db
    .select()
    .from(recipes)
    .where(whereClause)
    .orderBy(
      sortBy === 'popular' 
        ? desc(recipes.viewCount)
        : desc(recipes.createdAt)
    )
    .limit(limit)
    .offset(offset);
}

export async function getRecipesWithLikes(options: {
  limit?: number;
  offset?: number;
  sortBy?: 'recent' | 'popular' | 'mostLiked';
  category?: string;
  cuisineType?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const { limit = 20, offset = 0, sortBy = 'recent', category, cuisineType, userId } = options;

  // Build conditions array
  const conditions = [eq(recipes.isPublished, true)];
  if (category) conditions.push(eq(recipes.category, category));
  if (cuisineType) conditions.push(eq(recipes.cuisineType, cuisineType));
  if (userId) conditions.push(eq(recipes.submittedById, userId));

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  // Get recipes with like counts
  const result = await db
    .select({
      recipe: recipes,
      likeCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.recipeId = recipes.id)`.as('likeCount'),
    })
    .from(recipes)
    .where(whereClause)
    .orderBy(
      sortBy === 'mostLiked' 
        ? desc(sql`likeCount`)
        : sortBy === 'popular' 
          ? desc(recipes.viewCount)
          : desc(recipes.createdAt)
    )
    .limit(limit)
    .offset(offset);

  return result;
}

export async function incrementRecipeViews(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(recipes).set({ viewCount: sql`${recipes.viewCount} + 1` }).where(eq(recipes.id, id));
}

export async function updateRecipe(id: number, data: Partial<InsertRecipe>) {
  const db = await getDb();
  if (!db) return;

  await db.update(recipes).set(data).where(eq(recipes.id, id));
}

export async function deleteRecipe(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(recipes).where(eq(recipes.id, id));
}

export async function getRecipeCount() {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(recipes).where(eq(recipes.isPublished, true));
  return result[0]?.count ?? 0;
}

// ==================== FOLLOWER QUERIES ====================

export async function followUser(followerId: number, followingId: number) {
  const db = await getDb();
  if (!db) return;

  // Check if already following
  const existing = await db
    .select()
    .from(followers)
    .where(and(eq(followers.followerId, followerId), eq(followers.followingId, followingId)))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(followers).values({ followerId, followingId });
}

export async function unfollowUser(followerId: number, followingId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(followers).where(and(eq(followers.followerId, followerId), eq(followers.followingId, followingId)));
}

export async function isFollowing(followerId: number, followingId: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(followers)
    .where(and(eq(followers.followerId, followerId), eq(followers.followingId, followingId)))
    .limit(1);

  return result.length > 0;
}

export async function getFollowerCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(followers).where(eq(followers.followingId, userId));
  return result[0]?.count ?? 0;
}

export async function getFollowingCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(followers).where(eq(followers.followerId, userId));
  return result[0]?.count ?? 0;
}

export async function getFollowers(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({ user: users })
    .from(followers)
    .innerJoin(users, eq(followers.followerId, users.id))
    .where(eq(followers.followingId, userId))
    .limit(limit);

  return result.map(r => r.user);
}

export async function getFollowing(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({ user: users })
    .from(followers)
    .innerJoin(users, eq(followers.followingId, users.id))
    .where(eq(followers.followerId, userId))
    .limit(limit);

  return result.map(r => r.user);
}

// ==================== LIKE QUERIES ====================

export async function likeRecipe(userId: number, recipeId: number) {
  const db = await getDb();
  if (!db) return;

  // Check if already liked
  const existing = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.recipeId, recipeId)))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(likes).values({ userId, recipeId });
}

export async function unlikeRecipe(userId: number, recipeId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.recipeId, recipeId)));
}

export async function hasLikedRecipe(userId: number, recipeId: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.recipeId, recipeId)))
    .limit(1);

  return result.length > 0;
}

export async function getRecipeLikeCount(recipeId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(likes).where(eq(likes.recipeId, recipeId));
  return result[0]?.count ?? 0;
}

export async function getUserLikedRecipeIds(userId: number, recipeIds: number[]) {
  const db = await getDb();
  if (!db || recipeIds.length === 0) return [];

  const result = await db
    .select({ recipeId: likes.recipeId })
    .from(likes)
    .where(and(eq(likes.userId, userId), inArray(likes.recipeId, recipeIds)));

  return result.map(r => r.recipeId);
}

// ==================== COMMENT QUERIES ====================

export async function createComment(comment: InsertComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(comments).values(comment);
  return result[0].insertId;
}

export async function getCommentsByRecipeId(recipeId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      comment: comments,
      user: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.recipeId, recipeId))
    .orderBy(desc(comments.createdAt))
    .limit(limit);

  return result;
}

export async function getCommentCount(recipeId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(comments).where(eq(comments.recipeId, recipeId));
  return result[0]?.count ?? 0;
}

export async function deleteComment(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(comments).where(and(eq(comments.id, commentId), eq(comments.userId, userId)));
}

// ==================== BULK SEEDING ====================

export async function bulkInsertRecipes(recipesData: InsertRecipe[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(recipes).values(recipesData);
}

export async function getSeededRecipeCount() {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(recipes).where(eq(recipes.isSeeded, true));
  return result[0]?.count ?? 0;
}


// ==================== ANALYTICS QUERIES ====================

export interface AnalyticsStats {
  totalUsers: number;
  totalRecipes: number;
  usersByPeriod: { date: string; count: number }[];
  recipesByPeriod: { date: string; count: number }[];
}

export async function getAnalyticsStats(period: 'day' | 'week' | 'month'): Promise<AnalyticsStats> {
  const db = await getDb();
  if (!db) {
    return {
      totalUsers: 0,
      totalRecipes: 0,
      usersByPeriod: [],
      recipesByPeriod: [],
    };
  }

  // Get total counts
  const [totalUsersResult] = await db.select({ count: count() }).from(users);
  const [totalRecipesResult] = await db.select({ count: count() }).from(recipes).where(eq(recipes.isSeeded, false));

  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;
  let dateFormat: string;
  
  if (period === 'day') {
    // Last 30 days
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    dateFormat = '%Y-%m-%d';
  } else if (period === 'week') {
    // Last 12 weeks
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 84);
    dateFormat = '%Y-%u'; // Year-Week
  } else {
    // Last 12 months
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 12);
    dateFormat = '%Y-%m';
  }

  // Get users by period using raw SQL for date formatting
  // Use a subquery approach to avoid GROUP BY issues with sql_mode=only_full_group_by
  const usersByPeriodResult = await db.execute(
    sql`SELECT DATE_FORMAT(createdAt, ${dateFormat}) as date, COUNT(*) as count 
        FROM users 
        WHERE createdAt >= ${startDate} 
        GROUP BY DATE_FORMAT(createdAt, ${dateFormat}) 
        ORDER BY date`
  ) as unknown as [{ date: string; count: number }[], unknown];

  // Get recipes by period (excluding seeded recipes)
  const recipesByPeriodResult = await db.execute(
    sql`SELECT DATE_FORMAT(createdAt, ${dateFormat}) as date, COUNT(*) as count 
        FROM recipes 
        WHERE createdAt >= ${startDate} AND isSeeded = false 
        GROUP BY DATE_FORMAT(createdAt, ${dateFormat}) 
        ORDER BY date`
  ) as unknown as [{ date: string; count: number }[], unknown];

  // Extract results from raw query (first element is the rows array)
  const usersRows = usersByPeriodResult[0] || [];
  const recipesRows = recipesByPeriodResult[0] || [];

  return {
    totalUsers: totalUsersResult?.count ?? 0,
    totalRecipes: totalRecipesResult?.count ?? 0,
    usersByPeriod: usersRows.map((r: { date: string; count: number }) => ({ date: r.date, count: Number(r.count) })),
    recipesByPeriod: recipesRows.map((r: { date: string; count: number }) => ({ date: r.date, count: Number(r.count) })),
  };
}

export async function getRecentSignups(limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit);

  return result;
}

export async function getRecentRecipes(limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      submittedById: recipes.submittedById,
      createdAt: recipes.createdAt,
      isSeeded: recipes.isSeeded,
    })
    .from(recipes)
    .where(eq(recipes.isSeeded, false))
    .orderBy(desc(recipes.createdAt))
    .limit(limit);

  // Get submitter names
  const recipesWithSubmitters = await Promise.all(
    result.map(async (recipe) => {
      const submitter = await getUserById(recipe.submittedById);
      return {
        ...recipe,
        submitterName: submitter?.name ?? 'Unknown',
      };
    })
  );

  return recipesWithSubmitters;
}
