export interface SASjsWatingRequest {
  requestPromise: {
    promise: any;
    resolve: any;
    reject: any;
  };
  programName: string;
  data: any;
  params?: any;
}
