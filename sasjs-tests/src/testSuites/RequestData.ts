import SASjs, { ServerType, SASjsConfig } from "sasjs";
import { TestSuite } from "../types";

const specialCharData: any = {
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

const stringData: any = { table1: [{ col1: "first col value" }] };
const numericData: any = { table1: [{ col1: 3.14159265 }] };

const getLongStringData = (length = 32764) => {
  let x = "X";
  for (let i = 1; i <= length; i++) {
    x = x + "X";
  }
  const data: any = { table1: [{ col1: x }] };
  return data;
};

export const sendArrTests = (adapter: SASjs): TestSuite => ({
  name: "sendArr",
  tests: [
    {
      title: "Single string value",
      description: "Should send an array with a single string value",
      test: () => {
        return adapter.request("common/sendArr", stringData);
      },
      assertion: (res: any) => {
        return res.table1[0][0] === stringData.table1[0].col1;
      },
    },
    {
      title: "Long string value",
      description:
        "Should send an array with a long string value under 32765 characters",
      test: () => {
        return adapter.request("common/sendArr", getLongStringData());
      },
      assertion: (res: any) => {
        const longStringData = getLongStringData();
        return res.table1[0][0] === longStringData.table1[0].col1;
      },
    },
    {
      title: "Overly long string value",
      description:
        "Should error out with long string values over 32765 characters",
      test: () => {
        return adapter
          .request("common/sendArr", getLongStringData(32767))
          .catch((e) => e);
      },
      assertion: (error: any) => {
        return !!error && !!error.MESSAGE;
      },
    },
    {
      title: "Single numeric value",
      description: "Should send an array with a single numeric value",
      test: () => {
        return adapter.request("common/sendArr", numericData);
      },
      assertion: (res: any) => {
        return res.table1[0][0] === numericData.table1[0].col1;
      },
    },
    {
      title: "Special characters",
      description: "Should handle special characters",
      test: () => {
        return adapter.request("common/sendArr", specialCharData);
      },
      assertion: (res: any) => {
        return (
          res.table1[0][0] === specialCharData.table1[0].tab &&
          res.table1[0][1] === specialCharData.table1[0].lf &&
          res.table1[0][2] === specialCharData.table1[0].cr &&
          res.table1[0][3] === specialCharData.table1[0].semicolon &&
          res.table1[0][4] === "\n" &&
          res.table1[0][5] === specialCharData.table1[0].euro &&
          res.table1[0][6] === specialCharData.table1[0].banghash
        );
      },
    },
  ],
});

export const sendObjTests = (adapter: SASjs): TestSuite => ({
  name: "sendObj",
  tests: [
    {
      title: "Invalid column name",
      description: "Should throw an error",
      test: async () => {
        const invalidData: any = {
          "1 invalid table": [{ col1: 42 }],
        };
        return adapter.request("common/sendObj", invalidData).catch((e) => e);
      },
      assertion: (error: any) => !!error && !!error.MESSAGE,
    },
    {
      title: "Single string value",
      description: "Should send an object with a single string value",
      test: () => {
        return adapter.request("common/sendObj", stringData);
      },
      assertion: (res: any) => {
        return res.table1[0].COL1 === stringData.table1[0].col1;
      },
    },
    {
      title: "Long string value",
      description:
        "Should send an object with a long string value under 32765 characters",
      test: () => {
        return adapter.request("common/sendObj", getLongStringData());
      },
      assertion: (res: any) => {
        const longStringData = getLongStringData();
        return res.table1[0].COL1 === longStringData.table1[0].col1;
      },
    },
    {
      title: "Overly long string value",
      description:
        "Should error out with long string values over 32765 characters",
      test: () => {
        return adapter
          .request("common/sendObj", getLongStringData(32767))
          .catch((e) => e);
      },
      assertion: (error: any) => {
        return !!error && !!error.MESSAGE;
      },
    },
    {
      title: "Single numeric value",
      description: "Should send an object with a single numeric value",
      test: () => {
        return adapter.request("common/sendObj", numericData);
      },
      assertion: (res: any) => {
        return res.table1[0].COL1 === numericData.table1[0].col1;
      },
    },
  ],
});
