import SASjs from "sasjs";
import { TestSuite } from "../types";

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
        return (
          res.table1[0][0] === data.table1[0].tab &&
          res.table1[0][1] === data.table1[0].lf &&
          res.table1[0][2] === data.table1[0].cr &&
          // res.table1[0][3] === data.table1[0].semicolon
          res.table1[0][4] === "\n" &&
          res.table1[0][5] === data.table1[0].euro &&
          res.table1[0][6] === data.table1[0].banghash
        );
      },
    },
  ],
});
