import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Solo las paginas de login son publicas; el resto de la app (incluida la API)
// requiere sesion iniciada.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// En Next.js 16 el convenio "middleware" se renombro a "proxy" (mismo handler).
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Todas las rutas salvo internas de Next y archivos estaticos.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Siempre ejecutar en API routes.
    "/(api|trpc)(.*)",
  ],
};
