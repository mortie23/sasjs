import React, { ReactElement, useEffect, useState } from "react";
import TestCard from "./TestCard";

interface TestProps {
  title: string;
  description: string;
  beforeTest?: (...args: any) => Promise<any>;
  afterTest?: (...args: any) => Promise<any>;
  test: (context: any) => Promise<any>;
  assertion: (...args: any) => boolean;
  onCompleted: (payload: { result: boolean; error: Error | null }) => void;
  context: any;
}

const getStatus = (isRunning: boolean, isPassed: boolean): string => {
  return isRunning ? "running" : isPassed ? "passed" : "failed";
};

const Test = (props: TestProps): ReactElement<TestProps> => {
  const {
    title,
    description,
    test,
    beforeTest,
    afterTest,
    assertion,
    onCompleted,
    context,
  } = props;
  const beforeTestFunction = beforeTest ? beforeTest : () => Promise.resolve();
  const afterTestFunction = afterTest ? afterTest : () => Promise.resolve();
  const [isRunning, setIsRunning] = useState(false);
  const [isPassed, setIsPassed] = useState(false);

  useEffect(() => {
    if (test && assertion) {
      setIsRunning(true);
      setIsPassed(false);
      beforeTestFunction()
        .then(() => test(context))
        .then((res) => {
          setIsRunning(false);
          setIsPassed(assertion(res, context));
          return Promise.resolve(assertion(res, context));
        })
        .then((testResult) => {
          afterTestFunction();
          onCompleted({ result: testResult, error: null });
        })
        .catch((e) => {
          setIsRunning(false);
          setIsPassed(false);
          console.error(e);
          onCompleted({ result: false, error: e });
        });
    }
  }, [test, assertion]);

  return (
    <TestCard
      title={title}
      description={description}
      status={getStatus(isRunning, isPassed)}
      error={null}
    />
  );
};

export default Test;
