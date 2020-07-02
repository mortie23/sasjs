import SASjs from "sasjs";
import { TestSuite } from "../types";
import { assert } from "../utils/Assert";

const data: any = {
  table1: [
    {
      tab: "\t",
      lf: "\n",
      cr: "\r",
      semicolon: ";semi",
      crlf: "\r\n",
      euro: "€euro",
      banghash: "!#banghash",
    },
  ],
};

export const tests = (
  adapter: SASjs,
  userName: string,
  password: string
): TestSuite => ({
  name: "Tests",
  tests: [
    {
      title: "Log in",
      description: "Should log the user in",
      test: async () => {
        return adapter.logIn(userName, password);
      },
      assertion: (response: any) =>
        response && response.isLoggedIn && response.userName === userName,
    },
    {
      title: "Special characters",
      description: "Should handle special characters",
      test: () => {
        return adapter.request("common/sendArr", data);
      },
      assertion: (res: any) => {
        assert(!!res.table1[0][0]);
        assert(res.table1[0][0] === data.table1[0].tab);
        assert(res.table1[0][1] === data.table1[0].lf);
        assert(res.table1[0][2] === data.table1[0].cr);
        assert(res.table1[0][3] === data.table1[0].semicolon);
        assert(res.table1[0][4] === "\n");
        assert(res.table1[0][5] === data.table1[0].euro);
        assert(res.table1[0][6] === data.table1[0].banghash);
        return true;
      },
    },
  ],
});
