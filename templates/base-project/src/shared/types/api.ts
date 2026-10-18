export interface ApiPagination {
  page: number;
  size: number;
  total_pages: number;
  total_elements: number;
}

export interface ApiList<T> {
  list: {
    pagination: ApiPagination | null;
    content: T[];
  };
}

export interface ApiDetail<T> {
  detail: T;
}

export interface ApiResponse<T> {
  response_schema: {
    response_code: string;
    response_message: string;
  };
  response_output: T | null;
}
