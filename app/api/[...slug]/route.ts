// Any /api/* path without a route of its own: JSON 404 for every method.
import { apiError } from "../../../lib/apiError";

export const dynamic = "force-dynamic";

const notFound = (req: Request) => apiError(404, "not_found", `No API route at ${new URL(req.url).pathname}. See https://townhall.town/openapi.json`);
export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE, notFound as HEAD, notFound as OPTIONS };
