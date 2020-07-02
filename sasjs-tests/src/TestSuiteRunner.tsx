import React, { useEffect, useState, ReactElement, useContext } from "react";
import TestSuiteComponent from "./components/TestSuite";
import TestSuiteCard from "./components/TestSuiteCard";
import { TestSuite, Test } from "./types";
import { tests } from "./testSuites/Tests";
import "./TestSuiteRunner.scss";
import SASjs from "sasjs";
import { AppContext } from "./context/AppContext";

interface TestSuiteRunnerProps {
  adapter: SASjs;
}
const TestSuiteRunner = (
  props: TestSuiteRunnerProps
): ReactElement<TestSuiteRunnerProps> => {
  const { adapter } = props;
  const { config } = useContext(AppContext);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [runTests, setRunTests] = useState(false);
  const [completedTestSuites, setCompletedTestSuites] = useState<
    {
      name: string;
      completedTests: { test: Test; result: boolean; error: Error | null }[];
    }[]
  >([]);
  const [currentTestSuite, setCurrentTestSuite] = useState<TestSuite | null>(
    (null as unknown) as TestSuite
  );

  useEffect(() => {
    if (adapter) {
      setTestSuites([tests(adapter, config.userName, config.password)]);
      setCompletedTestSuites([]);
    }
  }, [adapter]);

  useEffect(() => {
    if (testSuites.length) {
      setCurrentTestSuite(testSuites[0]);
    }
  }, [testSuites]);

  useEffect(() => {
    if (runTests) {
      setCompletedTestSuites([]);
      setCurrentTestSuite(testSuites[0]);
    }
  }, [runTests, testSuites]);

  return (
    <>
      <div className="button-container">
        <button
          className={runTests ? "submit-button disabled" : "submit-button"}
          onClick={() => setRunTests(true)}
          disabled={runTests}
        >
          {runTests ? (
            <>
              <div className="loading-spinner"></div>Running tests...
            </>
          ) : (
            "Run tests!"
          )}
        </button>
      </div>
      {completedTestSuites.map((completedTestSuite, index) => {
        return (
          <TestSuiteCard
            key={index}
            tests={completedTestSuite.completedTests}
            name={completedTestSuite.name}
          />
        );
      })}
      {currentTestSuite && runTests && (
        <TestSuiteComponent
          {...currentTestSuite}
          onCompleted={(
            name,
            completedTests: {
              test: Test;
              result: boolean;
              error: Error | null;
            }[]
          ) => {
            const currentIndex = testSuites.indexOf(currentTestSuite);
            const nextIndex =
              currentIndex < testSuites.length - 1 ? currentIndex + 1 : -1;
            if (nextIndex >= 0) {
              setCurrentTestSuite(testSuites[nextIndex]);
            } else {
              setCurrentTestSuite(null);
            }
            const newCompletedTestSuites = [
              ...completedTestSuites,
              { name, completedTests },
            ];
            setCompletedTestSuites(newCompletedTestSuites);

            if (newCompletedTestSuites.length === testSuites.length) {
              setRunTests(false);
            }
          }}
        />
      )}
    </>
  );
};

export default TestSuiteRunner;
