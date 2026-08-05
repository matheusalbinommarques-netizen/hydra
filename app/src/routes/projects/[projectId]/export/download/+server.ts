import { buildExportResponse } from '../response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => buildExportResponse(params.projectId);
