import type { RequestHandler } from "express";
import {
  estimateRoute,
  estimateRouteMatrix,
  RoutingInputError,
  type RouteEstimateRequest,
  type RouteMatrixRequest,
} from "./client";

type RouteOptions = {
  authorize: RequestHandler;
};

function handler<T>(
  estimate: (input: T) => Promise<unknown>,
): (options: RouteOptions) => RequestHandler[] {
  return (options) => [
    options.authorize,
    async (request, response, next) => {
      try {
        response.json(await estimate(request.body as T));
      } catch (error) {
        if (error instanceof RoutingInputError) {
          response.status(400).json({ error: error.message });
          return;
        }
        next(error);
      }
    },
  ];
}

export const createRouteEstimateHandlers = handler(
  (input: RouteEstimateRequest) => estimateRoute(input),
);

export const createRouteMatrixHandlers = handler(
  (input: RouteMatrixRequest) => estimateRouteMatrix(input),
);
