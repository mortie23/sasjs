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

const debugStates = [Cypress.env("debug"), !Cypress.env("debug")]
debugStates.forEach(debugState => {
  context("Testing "+Cypress.env("serverType")+": debug="+debugState, () => {
    before(function() {
      // runs once before all tests in the block
      adapter.setDebugState(debugState)
    })
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

    it("01 special chars(tab, CRLF, CR)", done => {
      testStart();

      const data: any = {

        table1: [{ tab: '\t', lf: "\n", cr: "\r"
          ,semicolon:';semi'
          ,crlf:'\r\n'
          ,euro:"€euro"
          ,banghash:'!#banghash'
        }]
      };
      adapter.request("common/sendArr", data).then(
        (res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal(data.table1[0].tab);
          expect(res.table1[0][1]).to.be.equal(data.table1[0].lf);
          expect(res.table1[0][2]).to.be.equal(data.table1[0].cr);
          expect(res.table1[0][3]).to.be.equal(data.table1[0].semicolon);
          expect(res.table1[0][4]).to.be.equal("\n");
          expect(res.table1[0][5]).to.be.equal(data.table1[0].euro);
          expect(res.table1[0][6]).to.be.equal(data.table1[0].banghash);
          done();
        },
        err => {
          console.log(err);
        }
      );
    });


    it("02 special chars", done => {
      testStart();

      const data: any = {
        table1: [{ speech0:'"speech'
          ,pct:'%percent'
          ,speech:"\"speech"
          ,slash:"\\slash"
          ,slashWithSpecial:"\\\tslash"
          ,macvar:'&sysuserid'
          ,chinese: "传/傳chinese"
          ,sigma:"Σsigma"
          ,at:"@at"
          ,serbian:"Српски"
          ,dollar:"$"
        }]
      };
      adapter.request("common/sendArr", data).then(
        (res: any) => {
          testFinish();
          expect(res.table1[0][0]).to.be.equal(data.table1[0].speech0);
          expect(res.table1[0][1]).to.be.equal(data.table1[0].pct);
          expect(res.table1[0][2]).to.be.equal(data.table1[0].speech);
          expect(res.table1[0][3]).to.be.equal(data.table1[0].slash);
          expect(res.table1[0][4]).to.be.equal(data.table1[0].macvar);
          expect(res.table1[0][5]).to.be.equal(data.table1[0].chinese);
          expect(res.table1[0][6]).to.be.equal(data.table1[0].sigma);
          expect(res.table1[0][6]).to.be.equal(data.table1[0].at);
          expect(res.table1[0][8]).to.be.equal(data.table1[0].serbian);
          expect(res.table1[0][9]).to.be.equal(data.table1[0].dollar);
          done();
        },
        err => {
          console.log(err);
        }
      );
    });

    it("ARR, wide table(many columns)", done => {
      testStart();

      let cols: any = {};
      for (var i = 1; i <= 10000; i++) {
        cols["col" + i] = "test" + i;
      }

      const data: any = {
        table1: [cols]
      };
      adapter.request("common/sendArr", data).then(
        (res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;

          for (let i = 0; i <= 10; i++) {
            expect(res.table1[0][i]).to.be.equal(data.table1[0]["col" + (i + 1)]);
          }
          done();
        },
        err => {
          console.log(err);
        }
      );

      cy.wait(50000);
    });

    it("OBJ, wide table(many columns)", done => {
      testStart();

      let cols: any = {};
      for (var i = 1; i <= 10000; i++) {
        cols["col" + i] = "test" + i;
      }

      const data: any = {
        table1: [cols]
      };
      adapter.request("common/sendObj", data).then(
        (res: any) => {
          testFinish();

          expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
          for (let i = 0; i <= 10; i++) {
            expect(res.table1[0]["COL" + (i + 1)]).to.be.equal(
              data.table1[0]["col" + (i + 1)]
            );
          }
          done();
        },
        err => {
          console.log(err);
        }
      );

      cy.wait(50000);
    });

    it("ARR, many tables", done => {
      testStart();

      let tables: any = {};

      for (var i = 1; i <= 100; i++) {
        tables["table" + i] = [{ col1: "x", col2: "x", col3: "x", col4: "x" }];
      }

      const data: any = tables;
      adapter.request("common/sendArr", data).then(
        (res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
          expect(res.table1[0][1]).to.be.equal(data.table1[0].col2);
          expect(res.table1[0][2]).to.be.equal(data.table1[0].col3);
          expect(res.table1[0][3]).to.be.equal(data.table1[0].col4);
          expect(res.table50[0][0]).to.be.equal(data.table50[0].col1);
          expect(res.table50[0][1]).to.be.equal(data.table50[0].col2);
          expect(res.table50[0][2]).to.be.equal(data.table50[0].col3);
          expect(res.table50[0][3]).to.be.equal(data.table50[0].col4);
          done();
        },
        err => {
          console.log(err);
        }
      );
      cy.wait(70000);
    });

    it("ARR, big data 5MB", done => {
      testStart();

      let rows: any = [];
      let colData: string =
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      for (var i = 1; i <= 10000; i++) {
        rows.push({ col1: colData, col2: colData, col3: colData, col4: colData });
      }

      const data: any = {
        table1: rows
      };
      adapter.request("common/sendArr", data).then(
        (res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;

          for (let i = 0; i <= 10; i++) {
            expect(res.table1[i][0]).to.be.equal(data.table1[i][0]);
          }
          done();
        },
        err => {
          console.log(err);
        }
      );

      cy.wait(50000);
    });

    it("ARR, error and _csrf tables", done => {
      testStart();

      const data: any = {
        error: [{ col1: "q", col2: "w", col3: "e", col4: "r" }],
        _csrf: [{ col1: "q", col2: "w", col3: "e", col4: "r" }]
      };
      adapter.request("common/sendArr", data).then(
        (res: any) => {
          testFinish();

          expect(res.error[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.error[0][0]).to.be.equal(data.error[0].col1);
          expect(res.error[0][1]).to.be.equal(data.error[0].col2);
          expect(res.error[0][2]).to.be.equal(data.error[0].col3);
          expect(res.error[0][3]).to.be.equal(data.error[0].col4);
          expect(res._csrf[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res._csrf[0][0]).to.be.equal(data._csrf[0].col1);
          expect(res._csrf[0][1]).to.be.equal(data._csrf[0].col2);
          expect(res._csrf[0][2]).to.be.equal(data._csrf[0].col3);
          expect(res._csrf[0][3]).to.be.equal(data._csrf[0].col4);
          done();
        },
        err => {
          console.log(err);
        }
      );
    });

    it("OBJ, error and _csrf tables", done => {
      testStart();

      const data: any = {
        error: [{ col1: "q", col2: "w", col3: "e", col4: "r" }],
        _csrf: [{ col1: "q", col2: "w", col3: "e", col4: "r" }]
      };
      adapter.request("common/sendObj", data).then(
        (res: any) => {
          testFinish();

          expect(res.error[0].COL1, getTestExecTime()).to.not.be.undefined;
          expect(res.error[0].COL1).to.be.equal(data.error[0].col1);
          expect(res.error[0].COL2).to.be.equal(data.error[0].col2);
          expect(res.error[0].COL3).to.be.equal(data.error[0].col3);
          expect(res.error[0].COL4).to.be.equal(data.error[0].col4);
          expect(res._csrf[0].COL1, getTestExecTime()).to.not.be.undefined;
          expect(res._csrf[0].COL1).to.be.equal(data._csrf[0].col1);
          expect(res._csrf[0].COL2).to.be.equal(data._csrf[0].col2);
          expect(res._csrf[0].COL3).to.be.equal(data._csrf[0].col3);
          expect(res._csrf[0].COL4).to.be.equal(data._csrf[0].col4);
          done();
        },
        err => {
          console.log(err);
        }
      );
    });

    it("ARR, cells with quotes", done => {
      testStart();

      const data: any = {
        table1: [
          {
            col1: "x",
            col2: "one, two",
            col3: 'one "two" ',
            col4: 'one, "two"',
            col5: 10
          }
        ]
      };
      adapter.request("common/sendArr", data).then(
        (res: any) => {
          testFinish();

          expect(res.table1[0][0], getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0][0]).to.be.equal("x");
          expect(res.table1[0][1]).to.be.equal("one, two");
          expect(res.table1[0][2]).to.be.equal('one "two"');
          expect(res.table1[0][3]).to.be.equal('one, "two"');
          expect(res.table1[0][4]).to.be.equal(10);
          done();
        },
        err => {
          console.log(err);
        }
      );
    });

    it("OBJ, cells with quotes", done => {
      testStart();

      const data: any = {
        table1: [
          {
            col1: "x",
            col2: "one, two",
            col3: 'one "two"',
            col4: 'one, "two"',
            col5: 10
          }
        ]
      };
      adapter.request("common/sendObj", data).then(
        (res: any) => {
          testFinish();

          expect(res.table1[0].COL1, getTestExecTime()).to.not.be.undefined;
          expect(res.table1[0].COL1).to.be.equal("x");
          expect(res.table1[0].COL2).to.be.equal("one, two");
          expect(res.table1[0].COL3).to.be.equal('one "two"');
          expect(res.table1[0].COL4).to.be.equal('one, "two"');
          expect(res.table1[0].COL5).to.be.equal(10);
          done();
        },
        err => {
          console.log(err);
        }
      );
    });
  });
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
