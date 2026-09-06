export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiSuccessBody<T> = {
  success: true;
  data: T;
};
