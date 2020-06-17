import { SASjsRequest } from "../types/SASjsRequest";

export const compareTimestamps = (a: SASjsRequest, b: SASjsRequest) => {
  return b.timestamp.getTime() - a.timestamp.getTime();
};
