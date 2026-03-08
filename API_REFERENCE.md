# SG Recipe Book — REST API Reference

This document translates the current tRPC endpoints into equivalent REST API contracts. Your backend developer can use this as a specification to build a traditional REST API that the frontend can connect to.

---

## Base URL

```
https://sgrecipebook.com/api
```

## Authentication

All protected endpoints require a valid session. The current implementation uses JWT cookies (`app_session_id`). Your backend should:

1. Implement OAuth2 login with Google, Apple, and Microsoft
2. Issue a session token (JWT cookie or Bearer token)
3. Validate the token on every protected request
4. Return `401 Unauthorized` for invalid/missing tokens

---

## Endpoints

### Authentication

#### `GET /api/auth/me`
Returns the current authenticated user.

**Auth:** Optional (returns `null` if not authenticated)

**Response (200):**
```json
{
  "id": 1,
  "openId": "google-123456",
  "name": "Jason Tan",
  "email": "jason@example.com",
  "loginMethod": "google",
  "role": "user",
  "bio": "Home cook from Toa Payoh",
  "location": "Singapore",
  "avatarUrl": "https://...",
  "createdAt": "2026-01-15T08:30:00Z",
  "updatedAt": "2026-03-01T12:00:00Z",
  "lastSignedIn": "2026-03-08T10:00:00Z",
  "hasCompletedOnboarding": true
}
```

#### `POST /api/auth/logout`
Clears the session.

**Response (200):**
```json
{ "success": true }
```

---

### Recipes

#### `GET /api/recipes`
List recipes with pagination, sorting, and filtering.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Results per page (1-100) |
| `offset` | number | 0 | Pagination offset |
| `sortBy` | string | "recent" | "recent", "popular", or "mostLiked" |
| `category` | string | — | Filter by category |
| `cuisineType` | string | — | Filter by cuisine type |

**Response (200):**
```json
[
  {
    "id": 1,
    "submittedById": 5,
    "title": "Hainanese Chicken Rice",
    "slug": "hainanese-chicken-rice-x7k9m2",
    "shortCode": "abc123",
    "description": "Classic Singaporean chicken rice...",
    "originalCookName": "Auntie Lily",
    "originalCookLocation": "Toa Payoh",
    "relationshipToSubmitter": "her grandson",
    "ingredients": ["1 whole chicken (1.5kg)", "3 cups jasmine rice", "..."],
    "instructions": ["Poach the chicken in simmering water...", "..."],
    "prepTimeMinutes": 30,
    "cookTimeMinutes": 60,
    "servings": 4,
    "imageUrl": "https://s3.../chicken-rice.jpg",
    "category": "Main Dish",
    "cuisineType": "Chinese",
    "difficulty": "medium",
    "viewCount": 150,
    "isPublished": true,
    "isSeeded": true,
    "createdAt": "2026-01-01T00:00:00Z",
    "likeCount": 12,
    "commentCount": 3,
    "isLiked": false,
    "submitter": {
      "id": 5,
      "name": "Jason Tan",
      "avatarUrl": "https://..."
    }
  }
]
```

#### `GET /api/recipes/:slug`
Get a single recipe by its URL slug. Also increments the view count.

**Response (200):**
```json
{
  "id": 1,
  "title": "Hainanese Chicken Rice",
  "slug": "hainanese-chicken-rice-x7k9m2",
  "...": "...all recipe fields...",
  "likeCount": 12,
  "commentCount": 3,
  "isLiked": false,
  "isFollowingSubmitter": false,
  "submitter": {
    "id": 5,
    "name": "Jason Tan",
    "avatarUrl": "https://...",
    "bio": "Home cook from Toa Payoh",
    "location": "Singapore"
  }
}
```

#### `POST /api/recipes/tidy` (Protected)
AI-powered recipe tidying. Takes messy text input and returns structured recipe data.

**Request Body:**
```json
{
  "recipeName": "Chicken Curry",
  "ingredients": "500g chicken\n2 tbsp curry powder\n1 can coconut milk",
  "instructions": "Marinate chicken. Fry onions. Add chicken and cook.",
  "tips": "Use fresh spices for best flavor",
  "style": "structured"
}
```

**Response (200):**
```json
{
  "title": "Chicken Curry",
  "description": "A rich and aromatic chicken curry...",
  "ingredients": [
    "500g chicken thigh, cut into pieces",
    "2 tbsp curry powder",
    "1 can coconut milk (400ml)"
  ],
  "instructions": [
    "Marinate chicken with curry powder for 30 minutes.",
    "Heat oil in a pot and fry onions until golden.",
    "Add chicken and cook until browned.",
    "Pour in coconut milk and simmer for 20 minutes."
  ],
  "prepTimeMinutes": 35,
  "cookTimeMinutes": 30,
  "servings": 4,
  "tips": "Use fresh spices for best flavor",
  "category": "Main Dish",
  "cuisineType": "Indian",
  "difficulty": "medium"
}
```

**Error (400):** Input validation failures (placeholder text, too few ingredients, etc.)

#### `POST /api/recipes` (Protected)
Create a new recipe.

**Request Body:**
```json
{
  "title": "Chicken Curry",
  "description": "A rich and aromatic chicken curry...",
  "originalCookName": "Auntie May",
  "originalCookLocation": "Bedok",
  "relationshipToSubmitter": "her son",
  "ingredients": ["500g chicken", "2 tbsp curry powder"],
  "instructions": ["Marinate chicken", "Fry onions"],
  "prepTimeMinutes": 30,
  "cookTimeMinutes": 45,
  "servings": 4,
  "category": "Main Dish",
  "cuisineType": "Indian",
  "difficulty": "medium",
  "tips": "Use fresh spices",
  "displayStyle": "structured",
  "originalInput": "raw text...",
  "originalIngredients": "raw ingredients...",
  "originalInstructions": "raw instructions..."
}
```

**Response (201):**
```json
{
  "id": 15,
  "slug": "chicken-curry-x7k9m2",
  "shortCode": "abc123"
}
```

#### `PUT /api/recipes/:id` (Protected, Owner Only)
Update a recipe. Only the submitter or admin can update.

#### `DELETE /api/recipes/:id` (Protected, Owner Only)
Delete a recipe. Only the submitter or admin can delete.

#### `POST /api/recipes/:id/regenerate-image` (Protected, Owner Only)
Regenerate the AI image for a recipe.

**Response (200):**
```json
{ "success": true, "imageUrl": "https://s3.../new-image.jpg" }
```

#### `GET /api/recipes/user/:userId`
Get recipes submitted by a specific user.

**Query Parameters:** `limit` (default 20)

#### `GET /api/recipes/count`
Get total count of published recipes.

**Response (200):**
```json
{ "count": 14 }
```

---

### Social

#### `POST /api/social/like` (Protected)
Like a recipe.

**Request Body:** `{ "recipeId": 1 }`

#### `POST /api/social/unlike` (Protected)
Unlike a recipe.

**Request Body:** `{ "recipeId": 1 }`

#### `POST /api/social/follow` (Protected)
Follow a user. Cannot follow yourself.

**Request Body:** `{ "userId": 5 }`

#### `POST /api/social/unfollow` (Protected)
Unfollow a user.

**Request Body:** `{ "userId": 5 }`

#### `GET /api/social/is-following/:userId` (Protected)
Check if current user follows the given user.

**Response (200):**
```json
{ "isFollowing": true }
```

---

### Comments

#### `GET /api/comments/:recipeId`
Get comments for a recipe.

**Query Parameters:** `limit` (default 50)

**Response (200):**
```json
[
  {
    "comment": {
      "id": 1,
      "userId": 3,
      "recipeId": 1,
      "content": "This recipe is amazing!",
      "parentId": null,
      "createdAt": "2026-02-15T10:30:00Z",
      "updatedAt": "2026-02-15T10:30:00Z"
    },
    "user": {
      "id": 3,
      "name": "Sarah Lim",
      "avatarUrl": "https://..."
    }
  }
]
```

#### `POST /api/comments` (Protected)
Add a comment.

**Request Body:**
```json
{
  "recipeId": 1,
  "content": "This recipe is amazing!",
  "parentId": null
}
```

#### `DELETE /api/comments/:commentId` (Protected)
Delete own comment.

---

### User Profiles

#### `GET /api/users/:id`
Get user profile with stats.

**Response (200):**
```json
{
  "id": 5,
  "name": "Jason Tan",
  "bio": "Home cook from Toa Payoh",
  "location": "Singapore",
  "avatarUrl": "https://...",
  "createdAt": "2026-01-15T08:30:00Z",
  "followerCount": 25,
  "followingCount": 10,
  "recipeCount": 8,
  "isFollowing": false,
  "isOwnProfile": false
}
```

#### `PUT /api/users/profile` (Protected)
Update own profile.

**Request Body:**
```json
{
  "name": "Jason Tan",
  "bio": "Home cook from Toa Payoh",
  "location": "Singapore",
  "avatarUrl": "https://..."
}
```

#### `GET /api/users/:id/followers`
Get user's followers list.

#### `GET /api/users/:id/following`
Get who the user follows.

---

### Analytics (Admin Only)

#### `GET /api/analytics/stats` (Admin)
**Query Parameters:** `period` ("day" | "week" | "month")

#### `GET /api/analytics/recent-signups` (Admin)
**Query Parameters:** `limit` (default 10)

#### `GET /api/analytics/recent-recipes` (Admin)
**Query Parameters:** `limit` (default 10)

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Please provide at least 2 ingredients."
  }
}
```

| HTTP Status | tRPC Code | Description |
|-------------|-----------|-------------|
| 400 | BAD_REQUEST | Invalid input |
| 401 | UNAUTHORIZED | Not authenticated |
| 403 | FORBIDDEN | Not authorized (wrong role/owner) |
| 404 | NOT_FOUND | Resource not found |
| 500 | INTERNAL_SERVER_ERROR | Server error |

---

*End of API Reference*
