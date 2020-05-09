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

      it("Get sasRequests WORK tables after request", done => {
        testStart();

        const data: any = { table1: [{ col1: "first col value" }] };
        adapter.request("common/sendArr", data).then((res: any) => {
          testFinish();

          let sasRequests = adapter.getSasRequests();
          console.log(sasRequests);

          if (sasRequests && debugState) {
            expect(sasRequests[0].SASWORK).to.not.be.null;
          } else {
            expect(sasRequests[0].SASWORK).to.be.null;
          }

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
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
