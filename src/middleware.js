import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only these require a signed-in user. Everything else (marketing /, /about,
// /sign-in, /sign-up, /register, /auth/callback) stays public.
const isProtectedRoute = createRouteMatcher([
  "/set(.*)",
  "/flashcards(.*)",
  "/study(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
