import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * Component that detects new users (those who haven't completed onboarding)
 * and redirects them to the recipe submission flow.
 * 
 * This should be placed in the app layout to run on every page.
 */
export default function NewUserRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  const [location, navigate] = useLocation();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Don't do anything while loading
    if (loading) return;
    
    // Only redirect authenticated users
    if (!isAuthenticated || !user) return;
    
    // Don't redirect if already on the submit page
    if (location === "/submit") return;
    
    // Don't redirect if user has completed onboarding
    if (user.hasCompletedOnboarding) return;
    
    // Prevent multiple redirects
    if (hasRedirected.current) return;
    
    // New user detected - redirect to onboarding
    hasRedirected.current = true;
    navigate("/submit");
  }, [user, isAuthenticated, loading, location, navigate]);

  return null;
}
