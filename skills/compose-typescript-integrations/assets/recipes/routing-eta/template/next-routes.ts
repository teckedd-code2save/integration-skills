import {
  estimateRoute,
  estimateRouteMatrix,
  RoutingInputError,
  type RouteEstimateRequest,
  type RouteMatrixRequest,
} from "./client";

type RouteOptions = {
  authorize(request: Request): Promise<boolean>;
};

function failure(error: unknown): Response {
  if (error instanceof RoutingInputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  console.error("Routing provider request failed", error);
  return Response.json({ error: "Routing provider request failed" }, { status: 502 });
}

export function createRouteEstimateRoute(options: RouteOptions) {
  return async function POST(request: Request): Promise<Response> {
    try {
      if (!await options.authorize(request)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return Response.json(await estimateRoute(await request.json() as RouteEstimateRequest));
    } catch (error) {
      return failure(error);
    }
  };
}

export function createRouteMatrixRoute(options: RouteOptions) {
  return async function POST(request: Request): Promise<Response> {
    try {
      if (!await options.authorize(request)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return Response.json(await estimateRouteMatrix(await request.json() as RouteMatrixRequest));
    } catch (error) {
      return failure(error);
    }
  };
}
