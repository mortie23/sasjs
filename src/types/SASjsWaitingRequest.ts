export interface SASjsWaitingRequest {
  requestPromise: {
    promise: any;
    resolve: any;
    reject: any;
  };
  SASjob: string;
  data: any;
  params?: any;
}
