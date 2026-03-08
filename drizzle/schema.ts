import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  varchar,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Enums
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const displayStyleEnum = pgEnum("display_style", ["auntie", "structured"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  bio: text("bio"),
  location: varchar("location", { length: 128 }),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in", { withTimezone: true }).defaultNow().notNull(),
  /** Whether user has completed the onboarding flow (submitted first recipe) */
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Recipes table - stores all recipe submissions
 */
export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    /** User who submitted the recipe */
    submittedById: integer("submitted_by_id").notNull(),
    /** Recipe title e.g. "Chicken Curry" */
    title: varchar("title", { length: 256 }).notNull(),
    /** URL-friendly slug */
    slug: varchar("slug", { length: 256 }).notNull().unique(),
    /** Short code for sharing links e.g. "abc123" */
    shortCode: varchar("short_code", { length: 8 }).unique(),
    /** Recipe description */
    description: text("description"),
    /** Name of the original cook e.g. "Auntie May" */
    originalCookName: varchar("original_cook_name", { length: 128 }).notNull(),
    /** Location of the original cook e.g. "Toa Payoh" */
    originalCookLocation: varchar("original_cook_location", { length: 128 }),
    /** Relationship to the submitter e.g. "her son", "his daughter" */
    relationshipToSubmitter: varchar("relationship_to_submitter", { length: 128 }),
    /** Ingredients as JSON array */
    ingredients: jsonb("ingredients").$type<string[]>().notNull(),
    /** Instructions as JSON array of steps */
    instructions: jsonb("instructions").$type<string[]>().notNull(),
    /** Prep time in minutes */
    prepTimeMinutes: integer("prep_time_minutes"),
    /** Cook time in minutes */
    cookTimeMinutes: integer("cook_time_minutes"),
    /** Number of servings */
    servings: integer("servings"),
    /** Main image URL */
    imageUrl: text("image_url"),
    /** Additional image URLs */
    additionalImages: jsonb("additional_images").$type<string[]>(),
    /** Category e.g. "Main Dish", "Dessert" */
    category: varchar("category", { length: 64 }),
    /** Cuisine type e.g. "Chinese", "Malay", "Indian" */
    cuisineType: varchar("cuisine_type", { length: 64 }),
    /** Difficulty level */
    difficulty: difficultyEnum("difficulty").default("medium"),
    /** Tips and notes */
    tips: text("tips"),
    /** Original messy recipe input (preserved for trust/authenticity) */
    originalInput: text("original_input"),
    /** Original ingredients as entered by user */
    originalIngredients: text("original_ingredients"),
    /** Original instructions as entered by user */
    originalInstructions: text("original_instructions"),
    /** Display style preference: auntie (casual) or structured */
    displayStyle: displayStyleEnum("display_style").default("structured"),
    /** Whether recipe is published/visible */
    isPublished: boolean("is_published").default(true).notNull(),
    /** Whether this is a seeded recipe */
    isSeeded: boolean("is_seeded").default(false).notNull(),
    /** View count */
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("recipes_submitted_by_idx").on(table.submittedById),
    index("recipes_category_idx").on(table.category),
    index("recipes_cuisine_type_idx").on(table.cuisineType),
    index("recipes_is_published_idx").on(table.isPublished),
    index("recipes_created_at_idx").on(table.createdAt),
  ]
);

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = typeof recipes.$inferInsert;

/**
 * Followers table - tracks who follows whom
 */
export const followers = pgTable(
  "followers",
  {
    id: serial("id").primaryKey(),
    /** User who is following */
    followerId: integer("follower_id").notNull(),
    /** User being followed */
    followingId: integer("following_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("followers_unique_idx").on(table.followerId, table.followingId),
    index("followers_follower_idx").on(table.followerId),
    index("followers_following_idx").on(table.followingId),
  ]
);

export type Follower = typeof followers.$inferSelect;
export type InsertFollower = typeof followers.$inferInsert;

/**
 * Likes table - tracks recipe likes
 */
export const likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    /** User who liked */
    userId: integer("user_id").notNull(),
    /** Recipe that was liked */
    recipeId: integer("recipe_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("likes_unique_idx").on(table.userId, table.recipeId),
    index("likes_user_idx").on(table.userId),
    index("likes_recipe_idx").on(table.recipeId),
  ]
);

export type Like = typeof likes.$inferSelect;
export type InsertLike = typeof likes.$inferInsert;

/**
 * Comments table - tracks recipe comments
 */
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    /** User who commented */
    userId: integer("user_id").notNull(),
    /** Recipe being commented on */
    recipeId: integer("recipe_id").notNull(),
    /** Comment content */
    content: text("content").notNull(),
    /** Parent comment ID for replies */
    parentId: integer("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("comments_recipe_idx").on(table.recipeId),
    index("comments_user_idx").on(table.userId),
    index("comments_parent_idx").on(table.parentId),
  ]
);

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;
