# SG Recipe Book — Technical Documentation

**Prepared for:** Backend Developer Handoff
**Date:** March 8, 2026
**Version:** 1.0
**Domain:** sgrecipebook.com

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Database Schema](#3-database-schema)
4. [API Endpoints (tRPC)](#4-api-endpoints-trpc)
5. [Authentication Flow](#5-authentication-flow)
6. [AI Features](#6-ai-features)
7. [File Storage](#7-file-storage)
8. [Frontend Pages & Routes](#8-frontend-pages--routes)
9. [Data Models & TypeScript Types](#9-data-models--typescript-types)
10. [Environment Variables](#10-environment-variables)
11. [Design System](#11-design-system)
12. [Deployment Notes](#12-deployment-notes)

---

## 1. Project Overview

SG Recipe Book is a digital recipe book website that preserves Singapore's disappearing home cooking traditions. Users can contribute family recipes with an emotional "My Mum's Recipe" identity loop — each recipe is attributed to the original cook (e.g., "Auntie May's Chicken Curry, shared by Jason").

**Core Features:**
- Recipe submission with AI-powered tidying (cleans up messy handwritten-style recipes)
- AI image generation for recipes (auto-generates food photography if no image provided)
- Social features: follow users, like recipes, comment on recipes
- WhatsApp-optimized sharing with pre-filled messages
- User recipe books at `/book/{userId}`
- SSO authentication (Google, Apple, Microsoft)
- Admin analytics dashboard

**Current Tech Stack (Manus Platform):**

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 |
| Routing | Wouter (lightweight React router) |
| API Layer | tRPC 11 (type-safe RPC) |
| Backend | Express 4 + Node.js |
| Database | TiDB (MySQL-compatible) via Drizzle ORM |
| Auth | Manus OAuth (SSO via Google/Apple/Microsoft) |
| AI | Manus Forge API (LLM + Image Generation) |
| Storage | S3-compatible object storage |
| Styling | Tailwind CSS 4 + shadcn/ui components |

---

## 2. Architecture Overview

The application follows a **monorepo structure** with clear separation between client and server:

```
sg-recipe-book/
├── client/                    # Frontend React application
│   ├── public/                # Static assets (OG images, logos, favicon)
│   ├── src/
│   │   ├── _core/             # Auth hooks, tRPC client setup
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/            # shadcn/ui primitives (button, card, dialog, etc.)
│   │   │   ├── Header.tsx     # Global navigation header
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── NewUserRedirect.tsx
│   │   ├── contexts/          # React contexts (Theme)
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # tRPC client binding
│   │   ├── pages/             # Page-level components
│   │   │   ├── Home.tsx       # Landing page (visitors)
│   │   │   ├── HomeFeed.tsx   # Feed page (logged-in users)
│   │   │   ├── Recipes.tsx    # Browse all recipes
│   │   │   ├── RecipeDetail.tsx  # Single recipe view
│   │   │   ├── SubmitRecipe.tsx  # Recipe submission form
│   │   │   ├── Profile.tsx    # User recipe book
│   │   │   └── Analytics.tsx  # Admin analytics dashboard
│   │   ├── App.tsx            # Route definitions
│   │   ├── main.tsx           # Entry point with providers
│   │   └── index.css          # Global styles & design tokens
│   └── index.html             # HTML template with OG meta tags
├── server/
│   ├── _core/                 # Framework plumbing (DO NOT MODIFY)
│   │   ├── context.ts         # tRPC context builder
│   │   ├── trpc.ts            # tRPC initialization
│   │   ├── llm.ts             # LLM integration helper
│   │   ├── imageGeneration.ts # Image generation helper
│   │   ├── notification.ts    # Owner notification helper
│   │   ├── env.ts             # Environment variable access
│   │   └── cookies.ts         # Session cookie config
│   ├── db.ts                  # Database query helpers
│   ├── routers.ts             # tRPC route definitions (main API)
│   └── storage.ts             # S3 storage helpers
├── drizzle/
│   └── schema.ts              # Database schema (Drizzle ORM)
├── shared/
│   ├── const.ts               # Shared constants
│   └── types.ts               # Shared TypeScript types
└── storage/                   # S3 helper utilities
```

**Data Flow:**

```
Browser → React (Wouter routes) → tRPC Client → HTTP /api/trpc → tRPC Server → Drizzle ORM → TiDB/MySQL
                                                                      ↓
                                                              Manus Forge API (AI)
                                                              S3 Storage (Images)
```

---

## 3. Database Schema

The database uses **MySQL/TiDB** with 5 tables managed via **Drizzle ORM**. Below is the complete schema.

### 3.1 Users Table

Stores all registered users. Authentication is handled externally via OAuth; the `openId` field links to the OAuth provider's unique identifier.

```sql
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  openId      VARCHAR(64) NOT NULL UNIQUE,        -- OAuth provider unique ID
  name        TEXT,                                 -- Display name
  email       VARCHAR(320),                         -- Email address
  loginMethod VARCHAR(64),                          -- e.g., "google", "apple", "microsoft"
  role        ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  bio         TEXT,                                 -- User bio
  location    VARCHAR(128),                         -- User location
  avatarUrl   TEXT,                                 -- Profile picture URL
  createdAt   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hasCompletedOnboarding BOOLEAN NOT NULL DEFAULT FALSE
);
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INT (PK, auto-increment) | No | Internal user ID |
| `openId` | VARCHAR(64), UNIQUE | No | OAuth provider's unique identifier |
| `name` | TEXT | Yes | User display name |
| `email` | VARCHAR(320) | Yes | User email |
| `loginMethod` | VARCHAR(64) | Yes | OAuth provider name |
| `role` | ENUM('user','admin') | No | User role (default: 'user') |
| `bio` | TEXT | Yes | User biography |
| `location` | VARCHAR(128) | Yes | User location |
| `avatarUrl` | TEXT | Yes | Profile picture URL |
| `createdAt` | TIMESTAMP | No | Account creation date |
| `updatedAt` | TIMESTAMP | No | Last profile update |
| `lastSignedIn` | TIMESTAMP | No | Last login timestamp |
| `hasCompletedOnboarding` | BOOLEAN | No | Whether user completed onboarding |

### 3.2 Recipes Table

The core content table. Each recipe stores both the AI-tidied version and the original raw input for authenticity.

```sql
CREATE TABLE recipes (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  submittedById           INT NOT NULL,               -- FK to users.id
  title                   VARCHAR(256) NOT NULL,       -- Recipe name
  slug                    VARCHAR(256) NOT NULL UNIQUE, -- URL-friendly slug
  shortCode               VARCHAR(8) UNIQUE,           -- Short sharing code
  description             TEXT,                         -- Recipe description
  originalCookName        VARCHAR(128) NOT NULL,        -- "Auntie May", "My Mum"
  originalCookLocation    VARCHAR(128),                 -- "Toa Payoh", "Bedok"
  relationshipToSubmitter VARCHAR(128),                 -- "her son", "his daughter"
  ingredients             JSON NOT NULL,                -- Array of ingredient strings
  instructions            JSON NOT NULL,                -- Array of instruction steps
  prepTimeMinutes         INT,
  cookTimeMinutes         INT,
  servings                INT,
  imageUrl                TEXT,                         -- Main recipe image (S3 URL)
  additionalImages        JSON,                         -- Array of additional image URLs
  category                VARCHAR(64),                  -- "Main Dish", "Dessert", etc.
  cuisineType             VARCHAR(64),                  -- "Chinese", "Malay", "Indian"
  difficulty              ENUM('easy','medium','hard') DEFAULT 'medium',
  tips                    TEXT,                         -- Cooking tips
  originalInput           TEXT,                         -- Raw recipe text (pre-AI)
  originalIngredients     TEXT,                         -- Raw ingredients (pre-AI)
  originalInstructions    TEXT,                         -- Raw instructions (pre-AI)
  displayStyle            ENUM('auntie','structured') DEFAULT 'structured',
  isPublished             BOOLEAN NOT NULL DEFAULT TRUE,
  isSeeded                BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE for pre-loaded recipes
  viewCount               INT NOT NULL DEFAULT 0,
  createdAt               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INT (PK) | No | Recipe ID |
| `submittedById` | INT (FK → users.id) | No | User who submitted |
| `title` | VARCHAR(256) | No | Recipe name |
| `slug` | VARCHAR(256), UNIQUE | No | URL slug (e.g., "chicken-curry-abc123") |
| `shortCode` | VARCHAR(8), UNIQUE | Yes | 6-char sharing code |
| `description` | TEXT | Yes | Recipe description |
| `originalCookName` | VARCHAR(128) | No | Name of original cook |
| `originalCookLocation` | VARCHAR(128) | Yes | Cook's location in Singapore |
| `relationshipToSubmitter` | VARCHAR(128) | Yes | Relationship description |
| `ingredients` | JSON (string[]) | No | Array of ingredient strings |
| `instructions` | JSON (string[]) | No | Array of instruction steps |
| `prepTimeMinutes` | INT | Yes | Prep time in minutes |
| `cookTimeMinutes` | INT | Yes | Cook time in minutes |
| `servings` | INT | Yes | Number of servings |
| `imageUrl` | TEXT | Yes | Main image URL (S3) |
| `additionalImages` | JSON (string[]) | Yes | Extra image URLs |
| `category` | VARCHAR(64) | Yes | Recipe category |
| `cuisineType` | VARCHAR(64) | Yes | Cuisine type |
| `difficulty` | ENUM | Yes | easy/medium/hard |
| `tips` | TEXT | Yes | Cooking tips |
| `originalInput` | TEXT | Yes | Raw recipe text before AI tidying |
| `originalIngredients` | TEXT | Yes | Raw ingredients before AI tidying |
| `originalInstructions` | TEXT | Yes | Raw instructions before AI tidying |
| `displayStyle` | ENUM | Yes | auntie (casual) or structured |
| `isPublished` | BOOLEAN | No | Visibility flag |
| `isSeeded` | BOOLEAN | No | Pre-loaded recipe flag |
| `viewCount` | INT | No | Page view counter |

**JSON Field Formats:**

The `ingredients` field stores a JSON array of strings:
```json
["500g chicken thigh, cut into pieces", "2 tbsp curry powder", "1 can coconut milk (400ml)"]
```

The `instructions` field stores a JSON array of step strings:
```json
["Marinate chicken with curry powder for 30 minutes", "Heat oil in a pot and fry onions until golden", "Add chicken and cook until browned"]
```

### 3.3 Followers Table

Tracks user-to-user follow relationships.

```sql
CREATE TABLE followers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  followerId  INT NOT NULL,    -- FK to users.id (the follower)
  followingId INT NOT NULL,    -- FK to users.id (being followed)
  createdAt   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Relationship ID |
| `followerId` | INT (FK → users.id) | User who is following |
| `followingId` | INT (FK → users.id) | User being followed |
| `createdAt` | TIMESTAMP | When the follow occurred |

**Constraint:** A user cannot follow themselves (enforced in application logic).

### 3.4 Likes Table

Tracks recipe likes by users.

```sql
CREATE TABLE likes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  userId    INT NOT NULL,      -- FK to users.id
  recipeId  INT NOT NULL,      -- FK to recipes.id
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Like ID |
| `userId` | INT (FK → users.id) | User who liked |
| `recipeId` | INT (FK → recipes.id) | Recipe that was liked |
| `createdAt` | TIMESTAMP | When the like occurred |

**Constraint:** Each user can like a recipe only once (enforced in application logic via check-before-insert).

### 3.5 Comments Table

Supports threaded comments on recipes.

```sql
CREATE TABLE comments (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  userId    INT NOT NULL,      -- FK to users.id
  recipeId  INT NOT NULL,      -- FK to recipes.id
  content   TEXT NOT NULL,     -- Comment text
  parentId  INT,               -- FK to comments.id (for replies)
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Comment ID |
| `userId` | INT (FK → users.id) | Comment author |
| `recipeId` | INT (FK → recipes.id) | Recipe being commented on |
| `content` | TEXT | Comment text (max 2000 chars enforced in API) |
| `parentId` | INT (FK → comments.id) | Parent comment for threading (NULL = top-level) |

### 3.6 Entity Relationship Diagram

```
┌──────────┐       ┌──────────────┐       ┌──────────┐
│  users   │──1:N──│   recipes    │──1:N──│  likes   │
│          │       │              │       │          │
│ id (PK)  │       │ id (PK)      │       │ userId   │──→ users.id
│ openId   │       │ submittedById│──→    │ recipeId │──→ recipes.id
│ name     │       │ title        │       └──────────┘
│ email    │       │ slug         │
│ role     │       │ ingredients  │       ┌──────────┐
│ bio      │       │ instructions │──1:N──│ comments │
│ location │       │ imageUrl     │       │          │
│ avatarUrl│       │ category     │       │ userId   │──→ users.id
└──────────┘       │ cuisineType  │       │ recipeId │──→ recipes.id
     │             │ viewCount    │       │ parentId │──→ comments.id
     │             └──────────────┘       └──────────┘
     │
     ├──1:N──┌──────────┐
     │       │ followers│
     └──1:N──│          │
             │followerId│──→ users.id
             │followingId──→ users.id
             └──────────┘
```

---

## 4. API Endpoints (tRPC)

The API uses **tRPC** which provides type-safe RPC calls. All endpoints are served under `/api/trpc`. Below is every endpoint with its input/output contract.

### 4.1 Authentication

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| `auth.me` | Query | Public | Returns current logged-in user or `null` |
| `auth.logout` | Mutation | Public | Clears session cookie, returns `{ success: true }` |

**`auth.me` Response Shape:**
```typescript
{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
  hasCompletedOnboarding: boolean;
} | null
```

### 4.2 Recipe Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| `recipe.list` | Query | Public | List recipes with pagination, sorting, filtering |
| `recipe.getBySlug` | Query | Public | Get single recipe by URL slug |
| `recipe.tidyRecipe` | Mutation | Protected | AI-powered recipe tidying |
| `recipe.create` | Mutation | Protected | Submit a new recipe |
| `recipe.update` | Mutation | Protected | Update own recipe |
| `recipe.regenerateImage` | Mutation | Protected | Regenerate AI image for a recipe |
| `recipe.delete` | Mutation | Protected | Delete own recipe |
| `recipe.getByUser` | Query | Public | Get recipes by user ID |
| `recipe.count` | Query | Public | Get total published recipe count |

**`recipe.list` Input:**
```typescript
{
  limit?: number;    // 1-100, default 20
  offset?: number;   // default 0
  sortBy?: "recent" | "popular" | "mostLiked";  // default "recent"
  category?: string;       // e.g., "Main Dish"
  cuisineType?: string;    // e.g., "Chinese"
}
```

**`recipe.list` Response (array of):**
```typescript
{
  // All recipe fields from schema...
  likeCount: number;
  commentCount: number;
  isLiked: boolean;        // Whether current user has liked this
  submitter: {
    id: number;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}
```

**`recipe.getBySlug` Input:**
```typescript
{ slug: string }
```

**`recipe.getBySlug` Response:**
```typescript
{
  // All recipe fields from schema...
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isFollowingSubmitter: boolean;
  submitter: {
    id: number;
    name: string | null;
    avatarUrl: string | null;
    bio: string | null;
    location: string | null;
  } | null;
}
```

**`recipe.tidyRecipe` Input:**
```typescript
{
  recipeName: string;      // min 1 char
  ingredients: string;     // min 1 char, multiline text
  instructions: string;    // min 1 char, multiline text
  tips?: string;
  style: "auntie" | "structured";  // default "structured"
}
```

**`recipe.tidyRecipe` Response:**
```typescript
{
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  tips: string;
  category: string;
  cuisineType: string;
  difficulty: "easy" | "medium" | "hard";
}
```

**`recipe.create` Input:**
```typescript
{
  title: string;                    // 1-256 chars
  description?: string;
  originalCookName: string;         // 1-128 chars
  originalCookLocation?: string;    // max 128 chars
  relationshipToSubmitter?: string;  // max 128 chars
  ingredients: string[];            // Array of ingredient strings
  instructions: string[];           // Array of step strings
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  imageUrl?: string;
  additionalImages?: string[];
  category?: string;
  cuisineType?: string;
  difficulty?: "easy" | "medium" | "hard";
  tips?: string;
  displayStyle?: "auntie" | "structured";
  originalInput?: string;           // Raw text before AI tidying
  originalIngredients?: string;
  originalInstructions?: string;
}
```

**`recipe.create` Response:**
```typescript
{ id: number; slug: string; shortCode: string }
```

### 4.3 Social Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| `social.like` | Mutation | Protected | Like a recipe |
| `social.unlike` | Mutation | Protected | Unlike a recipe |
| `social.follow` | Mutation | Protected | Follow a user |
| `social.unfollow` | Mutation | Protected | Unfollow a user |
| `social.isFollowing` | Query | Protected | Check if following a user |

**Input for like/unlike:** `{ recipeId: number }`
**Input for follow/unfollow/isFollowing:** `{ userId: number }`

### 4.4 Comment Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| `comment.list` | Query | Public | Get comments for a recipe |
| `comment.create` | Mutation | Protected | Add a comment |
| `comment.delete` | Mutation | Protected | Delete own comment |

**`comment.create` Input:**
```typescript
{
  recipeId: number;
  content: string;     // 1-2000 chars
  parentId?: number;   // For threaded replies
}
```

**`comment.list` Response (array of):**
```typescript
{
  comment: {
    id: number;
    userId: number;
    recipeId: number;
    content: string;
    parentId: number | null;
    createdAt: Date;
    updatedAt: Date;
  };
  user: {
    id: number;
    name: string | null;
    avatarUrl: string | null;
  };
}
```

### 4.5 User Profile Endpoints

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| `user.getById` | Query | Public | Get user profile with stats |
| `user.updateProfile` | Mutation | Protected | Update own profile |
| `user.getFollowers` | Query | Public | Get user's followers |
| `user.getFollowing` | Query | Public | Get who user follows |

**`user.getById` Response:**
```typescript
{
  id: number;
  name: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  followerCount: number;
  followingCount: number;
  recipeCount: number;
  isFollowing: boolean;      // Whether current user follows this user
  isOwnProfile: boolean;     // Whether this is the current user's profile
}
```

### 4.6 Analytics Endpoints (Admin Only)

| Endpoint | Type | Auth | Description |
|----------|------|------|-------------|
| `analytics.getStats` | Query | Admin | Get signup/recipe stats by period |
| `analytics.getRecentSignups` | Query | Admin | Get recent user signups |
| `analytics.getRecentRecipes` | Query | Admin | Get recent recipe submissions |

**`analytics.getStats` Input:** `{ period: "day" | "week" | "month" }`

**`analytics.getStats` Response:**
```typescript
{
  totalUsers: number;
  totalRecipes: number;      // Excludes seeded recipes
  usersByPeriod: { date: string; count: number }[];
  recipesByPeriod: { date: string; count: number }[];
}
```

---

## 5. Authentication Flow

The current implementation uses **Manus OAuth** which wraps Google, Apple, and Microsoft SSO providers. For a custom backend, you would need to implement your own OAuth flow.

**Current Flow:**
1. User clicks "Sign In" → redirected to Manus OAuth portal
2. User authenticates with Google/Apple/Microsoft
3. OAuth callback at `/api/oauth/callback` creates/updates user record
4. Session cookie (`app_session_id`) is set with JWT token
5. Subsequent requests include cookie → server extracts user from JWT
6. `protectedProcedure` in tRPC checks for valid session; `publicProcedure` allows anonymous access

**For Custom Backend Implementation:**
- Replace Manus OAuth with your own OAuth2/OpenID Connect implementation
- The `openId` field in the users table maps to the OAuth provider's `sub` claim
- Session management can use JWT cookies (current approach) or any session strategy
- The `loginMethod` field stores which provider was used (e.g., "google", "apple")

---

## 6. AI Features

### 6.1 Recipe Tidying

The AI tidying feature takes messy, handwritten-style recipe text and structures it into a clean format. This is the core "magic" of the app.

**How it works:**
1. User enters raw ingredients and instructions in free-form text
2. Frontend sends to `recipe.tidyRecipe` endpoint
3. Server validates input against placeholder patterns (anti-hallucination)
4. Server calls LLM with a structured prompt
5. LLM returns structured JSON with cleaned recipe data
6. Frontend displays the tidied recipe for user review before submission

**Input Validation Rules (Anti-Hallucination):**
- Ingredients must have at least 2 lines with real words
- At least one line must contain food-related content
- Instructions must have at least 2 sentences with 5+ characters
- Blocks obvious placeholders: "blah", "test", "asdf", "lorem ipsum", "xxx", etc.

**LLM System Prompt (Key Rules):**
- ONLY organize and clean up what the user provides
- NEVER invent, add, or fabricate ingredients or steps
- If input is vague, keep it vague in the output
- Preserve the user's voice and cooking style
- Output must be valid JSON matching the response schema

### 6.2 AI Image Generation

When a user submits a recipe without an image, the system automatically generates a food photograph using AI.

**Prompt Template:**
```
Professional food photography of {cuisineType} {title}, home-cooked style, 
appetizing presentation on a plate, warm lighting, shallow depth of field, 
top-down angle, clean background
```

**For Custom Backend:** You can replace this with any image generation API (DALL-E, Midjourney API, Stability AI, etc.) or allow users to upload their own photos.

---

## 7. File Storage

Recipe images are stored in **S3-compatible object storage**. The current implementation uses Manus's built-in S3 service.

**Storage Pattern:**
```typescript
import { storagePut } from "./server/storage";

// Upload with non-enumerable path
const fileKey = `${userId}-files/${fileName}-${randomSuffix()}.png`;
const { url } = await storagePut(fileKey, fileBuffer, "image/png");
// url is a public CDN URL
```

**For Custom Backend:** Replace with any S3-compatible service (AWS S3, DigitalOcean Spaces, Cloudflare R2, etc.). Store the returned URL in the recipe's `imageUrl` field.

---

## 8. Frontend Pages & Routes

| Route | Component | Auth Required | Description |
|-------|-----------|---------------|-------------|
| `/` | `Home.tsx` / `HomeFeed.tsx` | No | Landing page (visitors) or recipe feed (logged-in) |
| `/recipes` | `Recipes.tsx` | No | Browse all recipes with search & category filters |
| `/recipe/:slug` | `RecipeDetail.tsx` | No | Individual recipe page |
| `/submit` | `SubmitRecipe.tsx` | Yes | Recipe submission form with AI tidying |
| `/book/:id` | `Profile.tsx` | No | User's recipe book (public profile) |
| `/profile/:id` | `Profile.tsx` | No | Alias for `/book/:id` (backwards compatibility) |
| `/analytics` | `Analytics.tsx` | Admin | Admin analytics dashboard |

**Key Frontend Components:**
- `Header.tsx` — Global navigation with search bar, logo, and auth controls
- `NewUserRedirect.tsx` — Redirects new users to submit page after first login
- `ErrorBoundary.tsx` — Global error boundary

**Recipe Categories Used:**
- Main Dish
- Breakfast
- Dessert
- Snack
- Soup
- Side Dish
- Drink

**Cuisine Types Used:**
- Chinese
- Malay
- Indian
- Peranakan
- Eurasian
- Others

---

## 9. Data Models & TypeScript Types

### 9.1 Drizzle Schema Types (Auto-inferred)

```typescript
// User type (inferred from schema)
type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
  hasCompletedOnboarding: boolean;
};

// Recipe type (inferred from schema)
type Recipe = {
  id: number;
  submittedById: number;
  title: string;
  slug: string;
  shortCode: string | null;
  description: string | null;
  originalCookName: string;
  originalCookLocation: string | null;
  relationshipToSubmitter: string | null;
  ingredients: string[];
  instructions: string[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number | null;
  imageUrl: string | null;
  additionalImages: string[] | null;
  category: string | null;
  cuisineType: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  tips: string | null;
  originalInput: string | null;
  originalIngredients: string | null;
  originalInstructions: string | null;
  displayStyle: "auntie" | "structured" | null;
  isPublished: boolean;
  isSeeded: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

// Follower type
type Follower = {
  id: number;
  followerId: number;
  followingId: number;
  createdAt: Date;
};

// Like type
type Like = {
  id: number;
  userId: number;
  recipeId: number;
  createdAt: Date;
};

// Comment type
type Comment = {
  id: number;
  userId: number;
  recipeId: number;
  content: string;
  parentId: number | null;
  createdAt: Date;
  updatedAt: Date;
};
```

### 9.2 Slug Generation

Recipe URLs use a slug format: `{title-in-kebab-case}-{6-char-nanoid}`

```typescript
function generateSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return `${baseSlug}-${nanoid(6)}`;
}
// Example: "Chicken Curry" → "chicken-curry-x7k9m2"
```

### 9.3 Short Codes

Each recipe also gets a 6-character `shortCode` (via nanoid) for compact sharing URLs.

---

## 10. Environment Variables

The following environment variables are required for the application to function:

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | MySQL/TiDB connection string | Yes |
| `JWT_SECRET` | Secret for signing session cookies | Yes |
| `VITE_APP_ID` | OAuth application ID | Yes |
| `OAUTH_SERVER_URL` | OAuth backend base URL | Yes |
| `VITE_OAUTH_PORTAL_URL` | OAuth login portal URL (frontend) | Yes |
| `OWNER_OPEN_ID` | Owner's OAuth ID (auto-promoted to admin) | Yes |
| `OWNER_NAME` | Owner's display name | No |
| `BUILT_IN_FORGE_API_URL` | LLM/AI API base URL | For AI features |
| `BUILT_IN_FORGE_API_KEY` | LLM/AI API key (server-side) | For AI features |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend AI API key | For AI features |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend AI API URL | For AI features |
| `VITE_APP_TITLE` | Application title | No |
| `VITE_APP_LOGO` | Application logo URL | No |
| `VITE_ANALYTICS_ENDPOINT` | Analytics tracking endpoint | No |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website ID | No |

**Note:** Variables prefixed with `VITE_` are exposed to the frontend bundle. All others are server-side only.

---

## 11. Design System

The frontend uses a carefully crafted design system inspired by NYT Cooking's editorial aesthetic.

### 11.1 Typography

| Element | Font | Weight |
|---------|------|--------|
| Headlines (h1-h6) | Source Serif 4 (serif) | 400-700 |
| Body text | Inter (sans-serif) | 400-600 |

### 11.2 Color Palette (OKLCH)

| Token | OKLCH Value | Usage |
|-------|-------------|-------|
| `--color-primary` | `oklch(0.55 0.22 27)` | Signature red (CTAs, links, accents) |
| `--color-background` | `oklch(1 0 0)` | White background |
| `--color-foreground` | `oklch(0.15 0 0)` | Near-black text |
| `--color-muted-foreground` | `oklch(0.45 0 0)` | Secondary text |
| `--color-border` | `oklch(0.9 0 0)` | Light gray borders |

### 11.3 Key CSS Utilities

The project defines custom utility classes in `index.css`:

- `.category-label` — Uppercase red category text
- `.author-link` — Underlined author name link
- `.recipe-card` — Card with hover image zoom effect
- `.search-input` — Rounded search input field
- `.btn-whatsapp` — WhatsApp green button
- `.btn-cta` — Primary red call-to-action button
- `.user-avatar` — Circular avatar with initials

### 11.4 Theme

The application uses a **light theme** by default. The ThemeProvider is set to `defaultTheme="light"`.

---

## 12. Deployment Notes

### 12.1 Current Seeded Data

The database is pre-loaded with 14 Singaporean recipes from a dummy user account (ID: 420005, "SG Recipe Book"). These recipes have `isSeeded: true` and include:

1. Hainanese Chicken Rice
2. Char Kway Teow
3. Hokkien Mee
4. Laksa
5. Bak Chor Mee
6. Nasi Lemak
7. Claypot Rice
8. Fried Rice
9. Mee Goreng
10. Ngoh Hiang
11. Curry Fish Head
12. Ayam Buah Keluak
13. Babi Pongteh
14. Chap Chye

### 12.2 WhatsApp Sharing

The sharing feature generates pre-filled text optimized for WhatsApp:

**Recipe Book Share:**
```
This is my family recipe book ❤️ We're saving our home recipes here so they won't be lost. 👉 sgrecipebook.com/book/{userId}
```

**Recipe Share:**
```
This is my family's {Recipe Name} recipe: 👉 sgrecipebook.com/recipe/{slug}
```

### 12.3 Open Graph

The site includes Open Graph meta tags for social sharing previews:
- Default OG image: 1200x630px JPEG (72KB) at `/og-image.jpg`
- Site name: "SG Recipe Book"
- Description: "Help preserve Singapore's home recipes before they're lost."

### 12.4 Admin Access

Admin users are determined by:
1. The `OWNER_OPEN_ID` environment variable (auto-promoted to admin on login)
2. Manual role update in the database: `UPDATE users SET role = 'admin' WHERE id = {userId}`

Admin-only features:
- `/analytics` dashboard
- Recipe deletion/editing of any recipe
- Image regeneration for any recipe

---

*End of Technical Documentation*
