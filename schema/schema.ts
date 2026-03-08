import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  bio: text("bio"),
  location: varchar("location", { length: 128 }),
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  /** Whether user has completed the onboarding flow (submitted first recipe) */
  hasCompletedOnboarding: boolean("hasCompletedOnboarding").default(false).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Recipes table - stores all recipe submissions
 */
export const recipes = mysqlTable("recipes", {
  id: int("id").autoincrement().primaryKey(),
  /** User who submitted the recipe */
  submittedById: int("submittedById").notNull(),
  /** Recipe title e.g. "Chicken Curry" */
  title: varchar("title", { length: 256 }).notNull(),
  /** URL-friendly slug */
  slug: varchar("slug", { length: 256 }).notNull().unique(),
  /** Short code for sharing links e.g. "abc123" */
  shortCode: varchar("shortCode", { length: 8 }).unique(),
  /** Recipe description */
  description: text("description"),
  /** Name of the original cook e.g. "Auntie May" */
  originalCookName: varchar("originalCookName", { length: 128 }).notNull(),
  /** Location of the original cook e.g. "Toa Payoh" */
  originalCookLocation: varchar("originalCookLocation", { length: 128 }),
  /** Relationship to the submitter e.g. "her son", "his daughter" */
  relationshipToSubmitter: varchar("relationshipToSubmitter", { length: 128 }),
  /** Ingredients as JSON array */
  ingredients: json("ingredients").$type<string[]>().notNull(),
  /** Instructions as JSON array of steps */
  instructions: json("instructions").$type<string[]>().notNull(),
  /** Prep time in minutes */
  prepTimeMinutes: int("prepTimeMinutes"),
  /** Cook time in minutes */
  cookTimeMinutes: int("cookTimeMinutes"),
  /** Number of servings */
  servings: int("servings"),
  /** Main image URL */
  imageUrl: text("imageUrl"),
  /** Additional image URLs */
  additionalImages: json("additionalImages").$type<string[]>(),
  /** Category e.g. "Main Dish", "Dessert" */
  category: varchar("category", { length: 64 }),
  /** Cuisine type e.g. "Chinese", "Malay", "Indian" */
  cuisineType: varchar("cuisineType", { length: 64 }),
  /** Difficulty level */
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium"),
  /** Tips and notes */
  tips: text("tips"),
  /** Original messy recipe input (preserved for trust/authenticity) */
  originalInput: text("originalInput"),
  /** Original ingredients as entered by user */
  originalIngredients: text("originalIngredients"),
  /** Original instructions as entered by user */
  originalInstructions: text("originalInstructions"),
  /** Display style preference: auntie (casual) or structured */
  displayStyle: mysqlEnum("displayStyle", ["auntie", "structured"]).default("structured"),
  /** Whether recipe is published/visible */
  isPublished: boolean("isPublished").default(true).notNull(),
  /** Whether this is a seeded recipe */
  isSeeded: boolean("isSeeded").default(false).notNull(),
  /** View count */
  viewCount: int("viewCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = typeof recipes.$inferInsert;

/**
 * Followers table - tracks who follows whom
 */
export const followers = mysqlTable("followers", {
  id: int("id").autoincrement().primaryKey(),
  /** User who is following */
  followerId: int("followerId").notNull(),
  /** User being followed */
  followingId: int("followingId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Follower = typeof followers.$inferSelect;
export type InsertFollower = typeof followers.$inferInsert;

/**
 * Likes table - tracks recipe likes
 */
export const likes = mysqlTable("likes", {
  id: int("id").autoincrement().primaryKey(),
  /** User who liked */
  userId: int("userId").notNull(),
  /** Recipe that was liked */
  recipeId: int("recipeId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Like = typeof likes.$inferSelect;
export type InsertLike = typeof likes.$inferInsert;

/**
 * Comments table - tracks recipe comments
 */
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  /** User who commented */
  userId: int("userId").notNull(),
  /** Recipe being commented on */
  recipeId: int("recipeId").notNull(),
  /** Comment content */
  content: text("content").notNull(),
  /** Parent comment ID for replies */
  parentId: int("parentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;
