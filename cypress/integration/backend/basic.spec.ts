/// <reference types="cypress" />
import SASjs from "../../../src/index";

const adapter = new SASjs({
  serverUrl: Cypress.env("serverUrl"),
  pathSAS9: "/SASStoredProcess/do",
  pathSASViya: "/SASJobExecution",
  appLoc: Cypress.env("appLoc"),
  serverType: Cypress.env("serverType"),
  debug: Cypress.env("debug")
});

const defaultConfig = {
  serverUrl: " ",
  pathSAS9: "/SASStoredProcess/do",
  pathSASViya: "/SASJobExecution",
  appLoc: "/Public/seedapp",
  serverType: "SASVIYA",
  debug: true
};

let timestampStart: number, timestampFinish: number;

const debugStates = [Cypress.env("debug"), !Cypress.env("debug")];
debugStates.forEach(debugState => {
  context(
    "Testing " + Cypress.env("serverType") + ": debug=" + debugState,
    () => {
      before(function() {
        // runs once before all tests in the block
        adapter.setDebugState(debugState);
      });
      it("User login", done => {
        adapter.logIn(Cypress.env("username"), Cypress.env("password")).then(
          (res: any) => {
            expect(res.isLoggedIn).to.equal(true);
            done();
          },
          err => {
            console.log(err);
            done("User not logged");
          }
        );
      });

      it("throws an error", done => {
        const data: any = {
          "1 invalid table": [{ col1: 42 }]
        };
        adapter.request("common/sendObj", data).then(null, (err: any) => {
          console.log(err);
          expect(err.MESSAGE).to.not.be.undefined;
          done();
        });
      });

    it("sasjs instantiated with no properties", done => {
      testStart();
      const sasjsObj = new SASjs();
      const sasConfig = sasjsObj.getSasjsConfig();
      testFinish();
      expect(sasConfig.serverUrl).to.be.equal(defaultConfig.serverUrl),
      expect(sasConfig.pathSAS9).to.be.equal(defaultConfig.pathSAS9);
      expect(sasConfig.pathSASViya).to.be.equal(defaultConfig.pathSASViya);
      expect(sasConfig.appLoc).to.be.equal(defaultConfig.appLoc);
      expect(sasConfig.serverType).to.be.equal(defaultConfig.serverType);
      expect(sasConfig.debug).to.be.equal(defaultConfig.debug);
      done();
    });

    it("sasjs instantiated with 2 properties", done => {
      testStart();
      const sasjsObj = new SASjs({serverType: "C1", debug: false});
      const sasConfig = sasjsObj.getSasjsConfig();
      testFinish();
      expect(sasConfig.serverUrl).to.be.equal(defaultConfig.serverUrl),
      expect(sasConfig.pathSAS9).to.be.equal(defaultConfig.pathSAS9);
      expect(sasConfig.pathSASViya).to.be.equal(defaultConfig.pathSASViya);
      expect(sasConfig.appLoc).to.be.equal(defaultConfig.appLoc);
      expect(sasConfig.serverType).to.be.equal("C1");
      expect(sasConfig.debug).to.be.equal(false);
      done();
    });

    it("sasjs instantiated with all properties", done => {
      testStart();
      const config = {
        serverUrl: "url",
        pathSAS9: "sas9",
        pathSASViya: "viya",
        appLoc: "/Public/seedapp",
        serverType: "TYPE",
        debug: false
      };
      const sasjsObj = new SASjs(config);
      const sasConfig = sasjsObj.getSasjsConfig();
      testFinish();
      expect(sasConfig.serverUrl).to.be.equal(config.serverUrl),
      expect(sasConfig.pathSAS9).to.be.equal(config.pathSAS9);
      expect(sasConfig.pathSASViya).to.be.equal(config.pathSASViya);
      expect(sasConfig.appLoc).to.be.equal(config.appLoc);
      expect(sasConfig.serverType).to.be.equal(config.serverType);
      expect(sasConfig.debug).to.be.equal(config.debug);
      done();
    });

    it("ARR, single string value", done => {
      testStart();

        const data: any = { table1: [{ col1: "first col value" }] };
        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
          done();
        });
      });

      it("OBJ, single string value", done => {
        testStart();

        const data: any = { table1: [{ col1: "first col value" }] };
        adapter.request("common/sendObj", data).then((res: any) => {
          testFinish();

          expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
          done();
        });
      });

      it("ARR, numerics", done => {
        testStart();
        /* cannot use repeat() function due to strange typings */
        const data: any = { table1: [{ col1: 3.14159265 }] };

        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
          done();
        });
      });

      it("ARR, long string (32765)", done => {
        testStart();
        /* cannot use repeat() function due to strange typings */
        let x = "X";
        for (var i = 1; i < 32765; i++) {
          x = x + "X";
        }
        const data: any = { table1: [{ col1: x }] };

        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
          done();
        });
      });

      it("OBJ, long string (32765)", done => {
        testStart();

        let x = "X";
        for (var i = 1; i < 32765; i++) {
          x = x + "X";
        }
        const data: any = { table1: [{ col1: x }] };
        adapter.request("common/sendObj", data).then((res: any) => {
          testFinish();

          expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
          done();
        });
      });

      it("OBJ, long string greater than (32765) throws error", done => {
        testStart();
        let x = "X";
        for (var i = 1; i < 32766; i++) {
          x = x + "X";
        }
        const data: any = { table1: [{ col1: x }] };
        adapter.request("common/sendObj", data).then(null, (err: any) => {
          testFinish();
          console.log(err);
          expect(err.MESSAGE).to.not.be.undefined;
          done();
        });
      });

      it("Bigger data", done => {
        testStart();

        let data = { table1: [{ big: "data" }] };

        for (var i = 1; i < 10000; i++) {
          data.table1.push(data.table1[0]);
        }

        adapter.request("common/sendObj", data).then((res: any) => {
          testFinish();
          expect(res.table1[9000].BIG, getTestExecTime()).to.not.be.undefined;
          done();
        });
      });

      it("ARR, multiple columns", done => {
        testStart();

        const data: any = {
          table1: [{ col1: 42, col2: 1.618, col3: "x", col4: "x" }]
        };
        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
          expect(res.table1[0][1]).to.be.equal(data.table1[0].col2);
          expect(res.table1[0][2]).to.be.equal(data.table1[0].col3);
          expect(res.table1[0][3]).to.be.equal(data.table1[0].col4);
          done();
        });
      });

      it("OBJ, multiple columns", done => {
        testStart();

        const data: any = {
          table1: [{ col1: 42, col2: 1.618, col3: "x", col4: "x" }]
        };
        adapter.request("common/sendObj", data).then((res: any) => {
          testFinish();

          expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
          expect(res.table1[0].COL2).to.be.equal(data.table1[0].col2);
          expect(res.table1[0].COL3).to.be.equal(data.table1[0].col3);
          expect(res.table1[0].COL4).to.be.equal(data.table1[0].col4);
          done();
        });
      });

      it("ARR, multiple rows with nulls", done => {
        testStart();

        const data: any = {
          table1: [
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: 1.62, col3: "x", col4: "x" },
            { col1: 42, col2: 1.62, col3: "x", col4: "x" }
          ]
        };
        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          data.table1.map((row: any, index: number) => {
            expect(res.table1[index][0]).to.be.equal(data.table1[index].col1);
            expect(res.table1[index][1]).to.be.equal(data.table1[index].col2);
            expect(res.table1[index][2]).to.be.equal(data.table1[index].col3);
            expect(res.table1[index][3]).to.be.equal(data.table1[index].col4);
          });
          done();
        });
      });

      it("OBJ, multiple rows with nulls", done => {
        testStart();

        const data: any = {
          table1: [
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: 1.62, col3: "x", col4: "x" },
            { col1: 42, col2: 1.62, col3: "x", col4: "x" }
          ]
        };
        adapter.request("common/sendObj", data).then((res: any) => {
          testFinish();

          expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
          data.table1.map((row: any, index: number) => {
            expect(res.table1[index].COL1).to.be.equal(data.table1[index].col1);
            expect(res.table1[index].COL2).to.be.equal(data.table1[index].col2);
            expect(res.table1[index].COL3).to.be.equal(data.table1[index].col3);
            expect(res.table1[index].COL4).to.be.equal(data.table1[index].col4);
          });
          done();
        });
      });

      it("ARR, column with all nulls", done => {
        testStart();

        const data: any = {
          table1: [
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" }
          ]
        };
        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          data.table1.map((row: any, index: number) => {
            expect(res.table1[index][0]).to.be.equal(data.table1[index].col1);
            expect(res.table1[index][1]).to.be.equal(data.table1[index].col2);
            expect(res.table1[index][2]).to.be.equal(data.table1[index].col3);
            expect(res.table1[index][3]).to.be.equal(data.table1[index].col4);
          });
          done();
        });
      });

      it("OBJ, column with all nulls", done => {
        testStart();

        const data: any = {
          table1: [
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" }
          ]
        };
        adapter.request("common/sendObj", data).then((res: any) => {
          testFinish();

          expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
          data.table1.map((row: any, index: number) => {
            expect(res.table1[index].COL1).to.be.equal(data.table1[index].col1);
            expect(res.table1[index].COL2).to.be.equal(data.table1[index].col2);
            expect(res.table1[index].COL3).to.be.equal(data.table1[index].col3);
            expect(res.table1[index].COL4).to.be.equal(data.table1[index].col4);
          });
          done();
        });
      });

      it("ARR, char column with nulls", done => {
        testStart();

        const data: any = {
          table1: [
            { col1: 42, col2: null, col3: "x", col4: null },
            { col1: 42, col2: null, col3: "x", col4: null },
            { col1: 42, col2: null, col3: "x", col4: null },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" }
          ]
        };
        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          data.table1.map((row: any, index: number) => {
            expect(res.table1[index][0]).to.be.equal(data.table1[index].col1);
            expect(res.table1[index][1]).to.be.equal(data.table1[index].col2);
            expect(res.table1[index][2]).to.be.equal(data.table1[index].col3);
            expect(res.table1[index][3]).to.be.equal("");
          });
          done();
        });
      });

      it("OBJ, char column with nulls", done => {
        testStart();

        const data: any = {
          table1: [
            { col1: 42, col2: null, col3: "x", col4: null },
            { col1: 42, col2: null, col3: "x", col4: null },
            { col1: 42, col2: null, col3: "x", col4: null },
            { col1: 42, col2: null, col3: "x", col4: "" },
            { col1: 42, col2: null, col3: "x", col4: "" }
          ]
        };
        adapter.request("common/sendObj", data).then((res: any) => {
          testFinish();

          expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
          data.table1.map((row: any, index: number) => {
            expect(res.table1[index].COL1).to.be.equal(data.table1[index].col1);
            expect(res.table1[index].COL2).to.be.equal(data.table1[index].col2);
            expect(res.table1[index].COL3).to.be.equal(data.table1[index].col3);
            expect(res.table1[index].COL4).to.be.equal("");
          });
          done();
        });
      });
    }
  );
});

const testStart = () => {
  timestampStart = new Date().getTime();
};

const testFinish = () => {
  timestampFinish = new Date().getTime();
};

const getTestExecTime = () => {
  return (
    "(Execution time: " +
    (timestampFinish - timestampStart) / 1000 +
    " seconds)"
  );
};
