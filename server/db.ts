import { eq, desc, and, sql, count, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { InsertUser, users, recipes, followers, likes, comments, InsertRecipe, InsertComment } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
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

  const db = getDb();
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

    values.hasCompletedOnboarding = true;

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, data: { name?: string; bio?: string; location?: string; avatarUrl?: string }) {
  const db = getDb();
  if (!db) return;

  await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function markOnboardingComplete(userId: number) {
  const db = getDb();
  if (!db) return;

  await db.update(users).set({ hasCompletedOnboarding: true, updatedAt: new Date() }).where(eq(users.id, userId));
}

// ==================== RECIPE QUERIES ====================

export async function createRecipe(recipe: InsertRecipe) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(recipes).values(recipe).returning({ id: recipes.id });
  return result[0].id;
}

export async function getRecipeById(id: number) {
  const db = getDb();
  if (!db) return undefined;

  const result = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecipeBySlug(slug: string) {
  const db = getDb();
  if (!db) return undefined;

  const result = await db.select().from(recipes).where(eq(recipes.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecipeByShortCode(shortCode: string) {
  const db = getDb();
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
  const db = getDb();
  if (!db) return [];

  const { limit = 20, offset = 0, sortBy = 'recent', category, cuisineType, userId } = options;

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
  const db = getDb();
  if (!db) return [];

  const { limit = 20, offset = 0, sortBy = 'recent', category, cuisineType, userId } = options;

  const conditions = [eq(recipes.isPublished, true)];
  if (category) conditions.push(eq(recipes.category, category));
  if (cuisineType) conditions.push(eq(recipes.cuisineType, cuisineType));
  if (userId) conditions.push(eq(recipes.submittedById, userId));

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const likeCountSql = sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.recipe_id = recipes.id)`.as('like_count');

  const result = await db
    .select({
      recipe: recipes,
      likeCount: likeCountSql,
    })
    .from(recipes)
    .where(whereClause)
    .orderBy(
      sortBy === 'mostLiked'
        ? desc(likeCountSql)
        : sortBy === 'popular'
          ? desc(recipes.viewCount)
          : desc(recipes.createdAt)
    )
    .limit(limit)
    .offset(offset);

  return result;
}

export async function incrementRecipeViews(id: number) {
  const db = getDb();
  if (!db) return;

  await db.update(recipes).set({ viewCount: sql`${recipes.viewCount} + 1` }).where(eq(recipes.id, id));
}

export async function updateRecipe(id: number, data: Partial<InsertRecipe>) {
  const db = getDb();
  if (!db) return;

  await db.update(recipes).set({ ...data, updatedAt: new Date() }).where(eq(recipes.id, id));
}

export async function deleteRecipe(id: number) {
  const db = getDb();
  if (!db) return;

  await db.delete(recipes).where(eq(recipes.id, id));
}

export async function getRecipeCount() {
  const db = getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(recipes).where(eq(recipes.isPublished, true));
  return result[0]?.count ?? 0;
}

// ==================== FOLLOWER QUERIES ====================

export async function followUser(followerId: number, followingId: number) {
  const db = getDb();
  if (!db) return;

  const existing = await db
    .select()
    .from(followers)
    .where(and(eq(followers.followerId, followerId), eq(followers.followingId, followingId)))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(followers).values({ followerId, followingId });
}

export async function unfollowUser(followerId: number, followingId: number) {
  const db = getDb();
  if (!db) return;

  await db.delete(followers).where(and(eq(followers.followerId, followerId), eq(followers.followingId, followingId)));
}

export async function isFollowing(followerId: number, followingId: number) {
  const db = getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(followers)
    .where(and(eq(followers.followerId, followerId), eq(followers.followingId, followingId)))
    .limit(1);

  return result.length > 0;
}

export async function getFollowerCount(userId: number) {
  const db = getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(followers).where(eq(followers.followingId, userId));
  return result[0]?.count ?? 0;
}

export async function getFollowingCount(userId: number) {
  const db = getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(followers).where(eq(followers.followerId, userId));
  return result[0]?.count ?? 0;
}

export async function getFollowers(userId: number, limit = 50) {
  const db = getDb();
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
  const db = getDb();
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
  const db = getDb();
  if (!db) return;

  const existing = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.recipeId, recipeId)))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(likes).values({ userId, recipeId });
}

export async function unlikeRecipe(userId: number, recipeId: number) {
  const db = getDb();
  if (!db) return;

  await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.recipeId, recipeId)));
}

export async function hasLikedRecipe(userId: number, recipeId: number) {
  const db = getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.recipeId, recipeId)))
    .limit(1);

  return result.length > 0;
}

export async function getRecipeLikeCount(recipeId: number) {
  const db = getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(likes).where(eq(likes.recipeId, recipeId));
  return result[0]?.count ?? 0;
}

export async function getUserLikedRecipeIds(userId: number, recipeIds: number[]) {
  const db = getDb();
  if (!db || recipeIds.length === 0) return [];

  const result = await db
    .select({ recipeId: likes.recipeId })
    .from(likes)
    .where(and(eq(likes.userId, userId), inArray(likes.recipeId, recipeIds)));

  return result.map(r => r.recipeId);
}

// ==================== COMMENT QUERIES ====================

export async function createComment(comment: InsertComment) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(comments).values(comment).returning({ id: comments.id });
  return result[0].id;
}

export async function getCommentsByRecipeId(recipeId: number, limit = 50) {
  const db = getDb();
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
  const db = getDb();
  if (!db) return 0;

  const result = await db.select({ count: count() }).from(comments).where(eq(comments.recipeId, recipeId));
  return result[0]?.count ?? 0;
}

export async function deleteComment(commentId: number, userId: number) {
  const db = getDb();
  if (!db) return;

  await db.delete(comments).where(and(eq(comments.id, commentId), eq(comments.userId, userId)));
}

// ==================== BULK SEEDING ====================

export async function bulkInsertRecipes(recipesData: InsertRecipe[]) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(recipes).values(recipesData);
}

export async function getSeededRecipeCount() {
  const db = getDb();
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
  const db = getDb();
  if (!db) {
    return { totalUsers: 0, totalRecipes: 0, usersByPeriod: [], recipesByPeriod: [] };
  }

  const [totalUsersResult] = await db.select({ count: count() }).from(users);
  const [totalRecipesResult] = await db.select({ count: count() }).from(recipes).where(eq(recipes.isSeeded, false));

  const now = new Date();
  let startDate: Date;
  let dateFormat: string;

  if (period === 'day') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    dateFormat = 'YYYY-MM-DD';
  } else if (period === 'week') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 84);
    dateFormat = 'IYYY-IW';
  } else {
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 12);
    dateFormat = 'YYYY-MM';
  }

  const usersByPeriodResult = await db.execute(
    sql`SELECT to_char(created_at, ${dateFormat}) as date, COUNT(*)::int as count
        FROM users WHERE created_at >= ${startDate}
        GROUP BY to_char(created_at, ${dateFormat}) ORDER BY date`
  );

  const recipesByPeriodResult = await db.execute(
    sql`SELECT to_char(created_at, ${dateFormat}) as date, COUNT(*)::int as count
        FROM recipes WHERE created_at >= ${startDate} AND is_seeded = false
        GROUP BY to_char(created_at, ${dateFormat}) ORDER BY date`
  );

  const usersRows = (usersByPeriodResult.rows || []) as { date: string; count: number }[];
  const recipesRows = (recipesByPeriodResult.rows || []) as { date: string; count: number }[];

  return {
    totalUsers: totalUsersResult?.count ?? 0,
    totalRecipes: totalRecipesResult?.count ?? 0,
    usersByPeriod: usersRows.map(r => ({ date: r.date, count: Number(r.count) })),
    recipesByPeriod: recipesRows.map(r => ({ date: r.date, count: Number(r.count) })),
  };
}

export async function getRecentSignups(limit = 10) {
  const db = getDb();
  if (!db) return [];

  return db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
    .from(users).orderBy(desc(users.createdAt)).limit(limit);
}

export async function getRecentRecipes(limit = 10) {
  const db = getDb();
  if (!db) return [];

  const result = await db.select({
    id: recipes.id, title: recipes.title, submittedById: recipes.submittedById,
    createdAt: recipes.createdAt, isSeeded: recipes.isSeeded,
  }).from(recipes).where(eq(recipes.isSeeded, false)).orderBy(desc(recipes.createdAt)).limit(limit);

  return Promise.all(result.map(async (recipe) => {
    const submitter = await getUserById(recipe.submittedById);
    return { ...recipe, submitterName: submitter?.name ?? 'Unknown' };
  }));
}
