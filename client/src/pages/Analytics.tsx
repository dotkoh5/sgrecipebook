import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BookOpen, TrendingUp, Calendar, Lock } from "lucide-react";
import { Link } from "wouter";

type Period = "day" | "week" | "month";

export default function Analytics() {
  const { user, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState<Period>("day");

  const { data: stats, isLoading: statsLoading } = trpc.analytics.getStats.useQuery(
    { period },
    { enabled: !!user && user.role === "admin" }
  );

  const { data: recentSignups } = trpc.analytics.getRecentSignups.useQuery(
    { limit: 10 },
    { enabled: !!user && user.role === "admin" }
  );

  const { data: recentRecipes } = trpc.analytics.getRecentRecipes.useQuery(
    { limit: 10 },
    { enabled: !!user && user.role === "admin" }
  );

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  // Check if user is admin
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              This page is only accessible to administrators.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <a className="text-red-600 hover:underline">Return to Home</a>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const periodLabels = {
    day: "Daily (Last 30 days)",
    week: "Weekly (Last 12 weeks)",
    month: "Monthly (Last 12 months)",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <a className="text-xl font-serif font-bold text-gray-900 hover:text-red-600">
                SG Recipe Book
              </a>
            </Link>
            <span className="text-gray-400">|</span>
            <h1 className="text-lg font-medium text-gray-700">Analytics Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Logged in as</span>
            <span className="font-medium text-gray-900">{user.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Users</CardTitle>
              <Users className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {statsLoading ? "..." : stats?.totalUsers ?? 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Registered accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">User Recipes</CardTitle>
              <BookOpen className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {statsLoading ? "..." : stats?.totalRecipes ?? 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Contributed by users (excl. seeded)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Page Views</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">—</div>
              <p className="text-xs text-gray-500 mt-1">Coming soon</p>
            </CardContent>
          </Card>
        </div>

        {/* Time Period Tabs */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="mb-8">
          <TabsList>
            <TabsTrigger value="day">Daily</TabsTrigger>
            <TabsTrigger value="week">Weekly</TabsTrigger>
            <TabsTrigger value="month">Monthly</TabsTrigger>
          </TabsList>

          <TabsContent value={period} className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Signups Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    User Signups
                  </CardTitle>
                  <CardDescription>{periodLabels[period]}</CardDescription>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                    </div>
                  ) : stats?.usersByPeriod && stats.usersByPeriod.length > 0 ? (
                    <div className="space-y-2">
                      {stats.usersByPeriod.map((item) => (
                        <div key={item.date} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-600">{item.date}</span>
                          <div className="flex items-center gap-2">
                            <div 
                              className="h-2 bg-red-500 rounded-full" 
                              style={{ width: `${Math.max(20, item.count * 20)}px` }}
                            />
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{item.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-gray-400">
                      No data for this period
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recipe Contributions Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-gray-400" />
                    Recipe Contributions
                  </CardTitle>
                  <CardDescription>{periodLabels[period]}</CardDescription>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                    </div>
                  ) : stats?.recipesByPeriod && stats.recipesByPeriod.length > 0 ? (
                    <div className="space-y-2">
                      {stats.recipesByPeriod.map((item) => (
                        <div key={item.date} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-600">{item.date}</span>
                          <div className="flex items-center gap-2">
                            <div 
                              className="h-2 bg-green-500 rounded-full" 
                              style={{ width: `${Math.max(20, item.count * 20)}px` }}
                            />
                            <span className="text-sm font-medium text-gray-900 w-8 text-right">{item.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-gray-400">
                      No data for this period
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Signups */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Signups</CardTitle>
              <CardDescription>Latest user registrations</CardDescription>
            </CardHeader>
            <CardContent>
              {recentSignups && recentSignups.length > 0 ? (
                <div className="space-y-3">
                  {recentSignups.map((user) => (
                    <div key={user.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{user.name || "Anonymous"}</p>
                        <p className="text-xs text-gray-500">{user.email || "No email"}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400">No recent signups</div>
              )}
            </CardContent>
          </Card>

          {/* Recent Recipes */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Recipes</CardTitle>
              <CardDescription>Latest user-contributed recipes</CardDescription>
            </CardHeader>
            <CardContent>
              {recentRecipes && recentRecipes.length > 0 ? (
                <div className="space-y-3">
                  {recentRecipes.map((recipe) => (
                    <div key={recipe.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{recipe.title}</p>
                        <p className="text-xs text-gray-500">by {recipe.submitterName}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {recipe.createdAt ? new Date(recipe.createdAt).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400">No user recipes yet</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Note about page views */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Page views and geographic breakdown analytics will be available once an analytics provider is configured.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
