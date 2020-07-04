import SASjs from "sasjs";
import { TestSuite } from "../types";

const specialCharData: any = {
  table1: [
    {
      tab: "\t",
      lf: "\n",
      cr: "\r",
      semicolon: ";semi",
      percent: "%",
      singleQuote: "'",
      doubleQuote: '"',
      crlf: "\r\n",
      euro: "€euro",
      banghash: "!#banghash",
    },
  ],
};

const stringData: any = { table1: [{ col1: "first col value" }] };
const numericData: any = { table1: [{ col1: 3.14159265 }] };
const multiColumnData: any = {
  table1: [{ col1: 42, col2: 1.618, col3: "x", col4: "x" }],
};

const getLongStringData = (length = 32764) => {
  let x = "X";
  for (let i = 1; i <= length; i++) {
    x = x + "X";
  }
  const data: any = { table1: [{ col1: x }] };
  return data;
};

const getLargeObjectData = () => {
  const data = { table1: [{ big: "data" }] };

  for (let i = 1; i < 10000; i++) {
    data.table1.push(data.table1[0]);
  }

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
          res.table1[0][4] === specialCharData.table1[0].percent &&
          res.table1[0][5] === specialCharData.table1[0].singleQuote &&
          res.table1[0][6] === specialCharData.table1[0].doubleQuote &&
          res.table1[0][7] === "\n" &&
          res.table1[0][8] === specialCharData.table1[0].euro &&
          res.table1[0][9] === specialCharData.table1[0].banghash
        );
      },
    },
    {
      title: "Multiple columns",
      description: "Should handle data with multiple columns",
      test: () => {
        return adapter.request("common/sendArr", multiColumnData);
      },
      assertion: (res: any) => {
        return (
          res.table1[0][0] === multiColumnData.table1[0].col1 &&
          res.table1[0][1] === multiColumnData.table1[0].col2 &&
          res.table1[0][2] === multiColumnData.table1[0].col3 &&
          res.table1[0][3] === multiColumnData.table1[0].col4
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

    {
      title: "Large data volume",
      description: "Should send an object with a large amount of data",
      test: () => {
        return adapter.request("common/sendObj", getLargeObjectData());
      },
      assertion: (res: any) => {
        const data = getLargeObjectData();
        return res.table1[9000].BIG === data.table1[9000].big;
      },
    },
    {
      title: "Multiple columns",
      description: "Should handle data with multiple columns",
      test: () => {
        return adapter.request("common/sendObj", multiColumnData);
      },
      assertion: (res: any) => {
        return (
          res.table1[0].COL1 === multiColumnData.table1[0].col1 &&
          res.table1[0].COL2 === multiColumnData.table1[0].col2 &&
          res.table1[0].COL3 === multiColumnData.table1[0].col3 &&
          res.table1[0].COL4 === multiColumnData.table1[0].col4
        );
      },
    },
  ],
});
