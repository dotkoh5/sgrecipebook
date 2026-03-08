import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import NewUserRedirect from "./components/NewUserRedirect";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import HomeFeed from "./pages/HomeFeed";
import Recipes from "./pages/Recipes";
import RecipeDetail from "./pages/RecipeDetail";
import SubmitRecipe from "./pages/SubmitRecipe";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import { useAuth } from "./_core/hooks/useAuth";

// Home page wrapper that shows HomeFeed for logged-in users
function HomePage() {
  const { user, loading } = useAuth();
  
  // Show loading state briefly
  if (loading) {
    return <Home />;
  }
  
  // Show HomeFeed for logged-in users, Home for visitors
  return user ? <HomeFeed /> : <Home />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/recipes" component={Recipes} />
      <Route path="/recipe/:slug" component={RecipeDetail} />
      <Route path="/submit" component={SubmitRecipe} />
      <Route path="/book/:id" component={Profile} />
      <Route path="/profile/:id" component={Profile} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <NewUserRedirect />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
