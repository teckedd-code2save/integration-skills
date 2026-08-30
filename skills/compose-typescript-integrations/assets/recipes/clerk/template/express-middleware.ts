import { clerkMiddleware, getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";

export const clerkAuthMiddleware = clerkMiddleware();

export const requireClerkAuth: RequestHandler = (request, response, next) => {
  const auth = getAuth(request);
  if (!auth.userId) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }
  response.locals.clerkAuth = auth;
  next();
};

export function getAuthenticatedUserId(request: Request) {
  const { userId } = getAuth(request);
  if (!userId) throw new Error("Unauthenticated request");
  return userId;
}
