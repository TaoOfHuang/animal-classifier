import { NextFunction, Request, Response } from 'express';
import { ApiErrorBody } from '../types/api';

export const notFoundHandler = (
  _req: Request,
  res: Response<ApiErrorBody>,
): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response<ApiErrorBody>,
  _next: NextFunction,
): void => {
  console.error('[errorHandler]', err.stack || err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    },
  });
};
