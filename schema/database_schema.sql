-- ============================================================
-- SG Recipe Book — Database Schema
-- MySQL/TiDB Compatible
-- Generated: March 8, 2026
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  openId                 VARCHAR(64) NOT NULL UNIQUE COMMENT 'OAuth provider unique identifier',
  name                   TEXT COMMENT 'Display name',
  email                  VARCHAR(320) COMMENT 'Email address',
  loginMethod            VARCHAR(64) COMMENT 'OAuth provider: google, apple, microsoft',
  role                   ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  bio                    TEXT COMMENT 'User biography',
  location               VARCHAR(128) COMMENT 'User location',
  avatarUrl              TEXT COMMENT 'Profile picture URL',
  createdAt              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  lastSignedIn           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hasCompletedOnboarding BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  submittedById           INT NOT NULL COMMENT 'FK to users.id',
  title                   VARCHAR(256) NOT NULL COMMENT 'Recipe name',
  slug                    VARCHAR(256) NOT NULL UNIQUE COMMENT 'URL-friendly slug: title-nanoid6',
  shortCode               VARCHAR(8) UNIQUE COMMENT '6-char sharing code',
  description             TEXT COMMENT 'Recipe description',
  originalCookName        VARCHAR(128) NOT NULL COMMENT 'Name of original cook e.g. Auntie May',
  originalCookLocation    VARCHAR(128) COMMENT 'Location e.g. Toa Payoh',
  relationshipToSubmitter VARCHAR(128) COMMENT 'e.g. her son, his daughter',
  ingredients             JSON NOT NULL COMMENT 'Array of ingredient strings',
  instructions            JSON NOT NULL COMMENT 'Array of instruction step strings',
  prepTimeMinutes         INT COMMENT 'Prep time in minutes',
  cookTimeMinutes         INT COMMENT 'Cook time in minutes',
  servings                INT COMMENT 'Number of servings',
  imageUrl                TEXT COMMENT 'Main recipe image URL (S3)',
  additionalImages        JSON COMMENT 'Array of additional image URLs',
  category                VARCHAR(64) COMMENT 'Main Dish, Breakfast, Dessert, Snack, Soup, Side Dish, Drink',
  cuisineType             VARCHAR(64) COMMENT 'Chinese, Malay, Indian, Peranakan, Eurasian, Others',
  difficulty              ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  tips                    TEXT COMMENT 'Cooking tips and notes',
  originalInput           TEXT COMMENT 'Raw recipe text before AI tidying',
  originalIngredients     TEXT COMMENT 'Raw ingredients before AI tidying',
  originalInstructions    TEXT COMMENT 'Raw instructions before AI tidying',
  displayStyle            ENUM('auntie', 'structured') DEFAULT 'structured',
  isPublished             BOOLEAN NOT NULL DEFAULT TRUE,
  isSeeded                BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'TRUE for pre-loaded sample recipes',
  viewCount               INT NOT NULL DEFAULT 0,
  createdAt               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_submittedById (submittedById),
  INDEX idx_category (category),
  INDEX idx_cuisineType (cuisineType),
  INDEX idx_isPublished (isPublished),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Followers table (user-to-user follow relationships)
CREATE TABLE IF NOT EXISTS followers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  followerId  INT NOT NULL COMMENT 'FK to users.id - the follower',
  followingId INT NOT NULL COMMENT 'FK to users.id - being followed',
  createdAt   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_follow (followerId, followingId),
  INDEX idx_followerId (followerId),
  INDEX idx_followingId (followingId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Likes table (recipe likes)
CREATE TABLE IF NOT EXISTS likes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  userId    INT NOT NULL COMMENT 'FK to users.id',
  recipeId  INT NOT NULL COMMENT 'FK to recipes.id',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_like (userId, recipeId),
  INDEX idx_userId (userId),
  INDEX idx_recipeId (recipeId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comments table (threaded comments on recipes)
CREATE TABLE IF NOT EXISTS comments (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  userId    INT NOT NULL COMMENT 'FK to users.id',
  recipeId  INT NOT NULL COMMENT 'FK to recipes.id',
  content   TEXT NOT NULL COMMENT 'Comment text, max 2000 chars enforced in API',
  parentId  INT COMMENT 'FK to comments.id for threaded replies, NULL = top-level',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_recipeId (recipeId),
  INDEX idx_userId (userId),
  INDEX idx_parentId (parentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Foreign Key Constraints (optional, add if your DB supports them)
-- ============================================================

-- ALTER TABLE recipes ADD CONSTRAINT fk_recipes_user FOREIGN KEY (submittedById) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE followers ADD CONSTRAINT fk_followers_follower FOREIGN KEY (followerId) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE followers ADD CONSTRAINT fk_followers_following FOREIGN KEY (followingId) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE likes ADD CONSTRAINT fk_likes_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE likes ADD CONSTRAINT fk_likes_recipe FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE;
-- ALTER TABLE comments ADD CONSTRAINT fk_comments_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE comments ADD CONSTRAINT fk_comments_recipe FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE;
-- ALTER TABLE comments ADD CONSTRAINT fk_comments_parent FOREIGN KEY (parentId) REFERENCES comments(id) ON DELETE SET NULL;
