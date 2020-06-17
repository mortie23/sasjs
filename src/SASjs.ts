import "isomorphic-fetch";
import * as e6p from "es6-promise";
(e6p as any).polyfill();
import {
  convertToCSV,
  compareTimestamps,
  serialize,
  isAuthorizeFormRequired,
  parseAndSubmitAuthorizeForm,
  splitChunks,
  isLogInRequired,
  isLogInSuccess,
  parseSourceCode,
  parseGeneratedCode,
  needsRetry,
} from "./utils";
import {
  SASjsConfig,
  SASjsRequest,
  SASjsWaitingRequest,
  ServerType,
} from "./types";
import { SASViyaApiClient } from "./SASViyaApiClient";
import { SAS9ApiClient } from "./SAS9ApiClient";

const defaultConfig: SASjsConfig = {
  serverUrl: "",
  pathSAS9: "/SASStoredProcess/do",
  pathSASViya: "/SASJobExecution",
  appLoc: "/Public/seedapp",
  serverType: ServerType.SASViya,
  debug: true,
};

const requestRetryLimit = 5;

/**
 * SASjs is a JavaScript adapter for SAS.
 *
 */
export default class SASjs {
  private sasjsConfig = new SASjsConfig();
  private jobsPath: string = "";
  private logoutUrl: string = "";
  private loginUrl: string = "";
  private _csrf: string | null = null;
  private retryCount: number = 0;
  private sasjsRequests: SASjsRequest[] = [];
  private sasjsWaitingRequests: SASjsWaitingRequest[] = [];
  private userName: string = "";
  private sasViyaApiClient: SASViyaApiClient | null = null;
  private sas9ApiClient: SAS9ApiClient | null = null;

  constructor(config?: any) {
    this.sasjsConfig = {
      ...defaultConfig,
      ...config,
    };

    this.setupConfiguration();
  }

  public async executeScriptSAS9(
    linesOfCode: string[],
    serverName: string,
    repositoryName: string
  ) {
    if (this.sasjsConfig.serverType !== ServerType.SAS9) {
      throw new Error("This operation is only supported on SAS9 servers.");
    }
    return await this.sas9ApiClient?.executeScript(
      linesOfCode,
      serverName,
      repositoryName
    );
  }

  public async getAllContexts(accessToken: string) {
    if (this.sasjsConfig.serverType !== ServerType.SASViya) {
      throw new Error("This operation is only supported on SAS Viya servers.");
    }
    return await this.sasViyaApiClient!.getAllContexts(accessToken);
  }

  public async getExecutableContexts(accessToken: string) {
    if (this.sasjsConfig.serverType !== ServerType.SASViya) {
      throw new Error("This operation is only supported on SAS Viya servers.");
    }
    return await this.sasViyaApiClient!.getExecutableContexts(accessToken);
  }

  public async createSession(contextName: string, accessToken: string) {
    if (this.sasjsConfig.serverType !== ServerType.SASViya) {
      throw new Error("This operation is only supported on SAS Viya servers.");
    }
    return await this.sasViyaApiClient!.createSession(contextName, accessToken);
  }

  public async executeScriptSASViya(
    fileName: string,
    linesOfCode: string[],
    contextName: string,
    accessToken: string,
    sessionId = "",
    silent = false
  ) {
    if (this.sasjsConfig.serverType !== ServerType.SASViya) {
      throw new Error("This operation is only supported on SAS Viya servers.");
    }
    return await this.sasViyaApiClient!.executeScript(
      fileName,
      linesOfCode,
      contextName,
      accessToken,
      sessionId,
      silent
    );
  }

  public async getAuthCode(clientId: string) {
    if (this.sasjsConfig.serverType !== ServerType.SASViya) {
      throw new Error("This operation is only supported on SAS Viya servers.");
    }
    return await this.sasViyaApiClient!.getAuthCode(clientId);
  }

  public async getAccessToken(
    clientId: string,
    clientSecret: string,
    authCode: string
  ) {
    if (this.sasjsConfig.serverType !== ServerType.SASViya) {
      throw new Error("This operation is only supported on SAS Viya servers.");
    }
    return await this.sasViyaApiClient!.getAccessToken(
      clientId,
      clientSecret,
      authCode
    );
  }

  public async refreshTokens(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ) {
    if (this.sasjsConfig.serverType !== ServerType.SASViya) {
      throw new Error("This operation is only supported on SAS Viya servers.");
    }
    return await this.sasViyaApiClient!.refreshTokens(
      clientId,
      clientSecret,
      refreshToken
    );
  }

  public async deleteClient(clientId: string, accessToken: string) {
    if (this.sasjsConfig.serverType !== ServerType.SASViya) {
      throw new Error("This operation is only supported on SAS Viya servers.");
    }
    return await this.sasViyaApiClient!.deleteClient(clientId, accessToken);
  }

  /**
   * Returns the current SASjs configuration.
   *
   */
  public getSasjsConfig() {
    return this.sasjsConfig;
  }

  /**
   * Returns the username of the user currently logged in.
   *
   */
  public getUserName() {
    return this.userName;
  }

  /**
   * Returns the _csrf token of the current session.
   *
   */
  public getCsrf() {
    return this._csrf;
  }

  /**
   * Sets the SASjs configuration.
   * @param config - SASjsConfig indicating SASjs Configuration
   */
  public async setSASjsConfig(config: SASjsConfig) {
    this.sasjsConfig = {
      ...this.sasjsConfig,
      ...config,
    };
    await this.setupConfiguration();
  }

  /**
   * Sets the debug state.
   * @param value - Boolean indicating debug state
   */
  public setDebugState(value: boolean) {
    this.sasjsConfig.debug = value;
  }

  /**
   * Checks whether a session is active, or login is required
   * @returns a promise which resolves with an object containing two values - a boolean `isLoggedIn`, and a string `userName`
   */
  public async checkSession() {
    const loginResponse = await fetch(this.loginUrl.replace(".do", ""));
    const responseText = await loginResponse.text();
    const isLoggedIn = /You have signed in./gm.test(responseText);

    return Promise.resolve({
      isLoggedIn,
      userName: this.userName,
    });
  }

  /**
   * Logs into the SAS server with the supplied credentials
   * @param username - a string representing the username
   * @param password - a string representing the password
   */
  public async logIn(username: string, password: string) {
    const loginParams: any = {
      _service: "default",
      username,
      password,
    };

    this.userName = loginParams.username;

    const { isLoggedIn } = await this.checkSession();
    if (isLoggedIn) {
      this.resendWaitingRequests();

      return Promise.resolve({
        isLoggedIn,
        userName: this.userName,
      });
    }

    const loginForm = await this.getLoginForm();

    for (const key in loginForm) {
      loginParams[key] = loginForm[key];
    }
    const loginParamsStr = serialize(loginParams);

    return fetch(this.loginUrl, {
      method: "post",
      credentials: "include",
      referrerPolicy: "same-origin",
      body: loginParamsStr,
      headers: new Headers({
        "Content-Type": "application/x-www-form-urlencoded",
      }),
    })
      .then((response) => response.text())
      .then(async (responseText) => {
        let authFormRes: any;
        let loggedIn;

        if (isAuthorizeFormRequired(responseText)) {
          authFormRes = await parseAndSubmitAuthorizeForm(
            responseText,
            this.sasjsConfig.serverUrl
          );
        } else {
          loggedIn = isLogInSuccess(responseText);
        }

        if (!loggedIn) {
          const currentSession = await this.checkSession();
          loggedIn = currentSession.isLoggedIn;
        }

        if (loggedIn) {
          this.resendWaitingRequests();
        }

        return {
          isLoggedIn: loggedIn,
          userName: this.userName,
        };
      })
      .catch((e) => Promise.reject(e));
  }

  /**
   * Logs out of the configured SAS server
   */
  public logOut() {
    return new Promise((resolve, reject) => {
      const logOutURL = `${this.sasjsConfig.serverUrl}${this.logoutUrl}`;
      fetch(logOutURL)
        .then(() => {
          resolve(true);
        })
        .catch((err: Error) => reject(err));
    });
  }

  /**
   * Makes a request to the program specified.
   * @param programName - a string representing the SAS program name
   * @param data - an object containing the data to be posted
   * @param params - an optional object with any additional parameters
   */
  public async request(
    programName: string,
    data: any,
    params?: any,
    loginRequiredCallback?: any
  ) {
    const program = this.sasjsConfig.appLoc
      ? this.sasjsConfig.appLoc.replace(/\/?$/, "/") +
        programName.replace(/^\//, "")
      : programName;
    const apiUrl = `${this.sasjsConfig.serverUrl}${this.jobsPath}/?_program=${program}`;

    const inputParams = params ? params : {};
    const requestParams = {
      ...inputParams,
      ...this.getRequestParams(),
    };

    const self = this;

    const formData = new FormData();

    let logInRequired = false;
    let isError = false;
    let errorMsg = "";

    if (data) {
      if (this.sasjsConfig.serverType === ServerType.SAS9) {
        // file upload approach
        for (const tableName in data) {
          if (isError) {
            return;
          }
          const name = tableName;
          const csv = convertToCSV(data[tableName]);
          if (csv === "ERROR: LARGE STRING LENGTH") {
            isError = true;
            errorMsg =
              "The max length of a string value in SASjs is 32765 characters.";
          }

          formData.append(
            name,
            new Blob([csv], { type: "application/csv" }),
            `${name}.csv`
          );
        }
      } else {
        // param based approach
        const sasjsTables = [];
        let tableCounter = 0;
        for (const tableName in data) {
          if (isError) {
            return;
          }
          tableCounter++;
          sasjsTables.push(tableName);
          const csv = convertToCSV(data[tableName]);
          if (csv === "ERROR: LARGE STRING LENGTH") {
            isError = true;
            errorMsg =
              "The max length of a string value in SASjs is 32765 characters.";
          }
          // if csv has length more then 16k, send in chunks
          if (csv.length > 16000) {
            const csvChunks = splitChunks(csv);
            // append chunks to form data with same key
            csvChunks.map((chunk) => {
              formData.append(`sasjs${tableCounter}data`, chunk);
            });
          } else {
            requestParams[`sasjs${tableCounter}data`] = csv;
          }
        }
        requestParams["sasjs_tables"] = sasjsTables.join(" ");
      }
    }

    for (const key in requestParams) {
      if (requestParams.hasOwnProperty(key)) {
        formData.append(key, requestParams[key]);
      }
    }

    const sasjsWaitingRequest: SASjsWaitingRequest = {
      requestPromise: {
        promise: null,
        resolve: null,
        reject: null,
      },
      programName,
      data,
      params,
    };

    let isRedirected = false;

    sasjsWaitingRequest.requestPromise.promise = new Promise(
      (resolve, reject) => {
        if (isError) {
          reject({ MESSAGE: errorMsg });
        }
        fetch(apiUrl, {
          method: "POST",
          body: formData,
          referrerPolicy: "same-origin",
        })
          .then(async (response) => {
            if (!response.ok) {
              if (response.status === 403) {
                const tokenHeader = response.headers.get("X-CSRF-HEADER");

                if (tokenHeader) {
                  const token = response.headers.get(tokenHeader);

                  this._csrf = token;
                }
              }
            }

            if (
              response.redirected &&
              this.sasjsConfig.serverType === ServerType.SAS9
            ) {
              isRedirected = true;
            }

            return response.text();
          })
          .then((responseText) => {
            if (
              (needsRetry(responseText) || isRedirected) &&
              !isLogInRequired(responseText)
            ) {
              if (this.retryCount < requestRetryLimit) {
                this.retryCount++;
                this.request(programName, data, params).then(
                  (res: any) => resolve(res),
                  (err: any) => reject(err)
                );
              } else {
                this.retryCount = 0;
                reject(responseText);
              }
            } else {
              this.retryCount = 0;
              this.parseLogFromResponse(responseText, program);

              if (isLogInRequired(responseText)) {
                if (loginRequiredCallback) loginRequiredCallback(true);
                logInRequired = true;
                sasjsWaitingRequest.requestPromise.resolve = resolve;
                sasjsWaitingRequest.requestPromise.reject = reject;
                this.sasjsWaitingRequests.push(sasjsWaitingRequest);
              } else {
                if (
                  this.sasjsConfig.serverType === ServerType.SAS9 &&
                  this.sasjsConfig.debug
                ) {
                  this.updateUsername(responseText);
                  const jsonResponseText = this.parseSAS9Response(responseText);

                  if (jsonResponseText !== "") {
                    resolve(JSON.parse(jsonResponseText));
                  } else {
                    reject({
                      MESSAGE: this.parseSAS9ErrorResponse(responseText),
                    });
                  }
                } else if (
                  this.sasjsConfig.serverType === ServerType.SASViya &&
                  this.sasjsConfig.debug
                ) {
                  try {
                    this.parseSASVIYADebugResponse(responseText).then(
                      (resText: any) => {
                        this.updateUsername(resText);
                        try {
                          resolve(JSON.parse(resText));
                        } catch (e) {
                          reject({ MESSAGE: resText });
                        }
                      },
                      (err: any) => {
                        reject({ MESSAGE: err });
                      }
                    );
                  } catch (e) {
                    reject({ MESSAGE: responseText });
                  }
                } else {
                  this.updateUsername(responseText);
                  try {
                    const parsedJson = JSON.parse(responseText);
                    resolve(parsedJson);
                  } catch (e) {
                    reject({ MESSAGE: responseText });
                  }
                }
              }
            }
          })
          .catch((e: Error) => {
            reject(e);
          });
      }
    );

    return sasjsWaitingRequest.requestPromise.promise;
  }

  private async resendWaitingRequests() {
    for (const sasjsWaitingRequest of this.sasjsWaitingRequests) {
      this.request(
        sasjsWaitingRequest.programName,
        sasjsWaitingRequest.data,
        sasjsWaitingRequest.params
      ).then(
        (res: any) => {
          sasjsWaitingRequest.requestPromise.resolve(res);
        },
        (err: any) => {
          sasjsWaitingRequest.requestPromise.reject(err);
        }
      );
    }

    this.sasjsWaitingRequests = [];
  }

  private getRequestParams(): any {
    const requestParams: any = {};

    if (this._csrf) {
      requestParams["_csrf"] = this._csrf;
    }

    if (this.sasjsConfig.debug) {
      requestParams["_omittextlog"] = "false";
      requestParams["_omitsessionresults"] = "false";

      requestParams["_debug"] = 131;
    }

    return requestParams;
  }

  private updateUsername(response: any) {
    try {
      const responseJson = JSON.parse(response);
      if (this.sasjsConfig.serverType === ServerType.SAS9) {
        this.userName = responseJson["_METAUSER"];
      } else {
        this.userName = responseJson["SYSUSERID"];
      }
    } catch (e) {
      this.userName = "";
    }
  }

  private parseSASVIYADebugResponse(response: string) {
    return new Promise((resolve, reject) => {
      const iframeStart = response.split(
        '<iframe style="width: 99%; height: 500px" src="'
      )[1];
      const jsonUrl = iframeStart ? iframeStart.split('"></iframe>')[0] : null;

      if (jsonUrl) {
        fetch(this.sasjsConfig.serverUrl + jsonUrl)
          .then((res) => res.text())
          .then((resText) => {
            resolve(resText);
          });
      } else {
        reject("No debug info in response");
      }
    });
  }

  private parseSAS9Response(response: string) {
    let sas9Response = "";

    if (response.includes(">>weboutBEGIN<<")) {
      try {
        sas9Response = response
          .split(">>weboutBEGIN<<")[1]
          .split(">>weboutEND<<")[0];
      } catch (e) {
        sas9Response = "";
        console.error(e);
      }
    }

    return sas9Response;
  }

  private parseSAS9ErrorResponse(response: string) {
    const logLines = response.split("\n");
    const parsedLines: string[] = [];
    let firstErrorLineIndex: number = -1;

    logLines.map((line: string, index: number) => {
      if (
        line.toLowerCase().includes("error") &&
        !line.toLowerCase().includes("this request completed with errors.") &&
        firstErrorLineIndex === -1
      ) {
        firstErrorLineIndex = index;
      }
    });

    for (let i = firstErrorLineIndex - 10; i <= firstErrorLineIndex + 10; i++) {
      parsedLines.push(logLines[i]);
    }

    return parsedLines.join(", ");
  }

  private parseLogFromResponse(response: any, program: string) {
    if (this.sasjsConfig.serverType === ServerType.SAS9) {
      this.appendSasjsRequest(response, program, null);
    } else {
      if (!this.sasjsConfig.debug) {
        this.appendSasjsRequest(null, program, null);
      } else {
        this.appendSasjsRequest(response, program, null);
      }
    }
  }

  private fetchLogFileContent(logLink: string) {
    return new Promise((resolve, reject) => {
      fetch(logLink, {
        method: "GET",
      })
        .then((response: any) => response.text())
        .then((response: any) => resolve(response))
        .catch((err: Error) => reject(err));
    });
  }

  private async appendSasjsRequest(
    response: any,
    program: string,
    pgmData: any
  ) {
    let sourceCode = "";
    let generatedCode = "";
    let sasWork = null;

    if (response) {
      sourceCode = parseSourceCode(response);
      generatedCode = parseGeneratedCode(response);
      sasWork = await this.parseSasWork(response);
    }

    this.sasjsRequests.push({
      logFile: response,
      serviceLink: program,
      timestamp: new Date(),
      sourceCode,
      generatedCode,
      SASWORK: sasWork,
    });

    if (this.sasjsRequests.length > 20) {
      this.sasjsRequests.splice(0, 1);
    }
  }

  private async parseSasWork(response: any) {
    if (this.sasjsConfig.debug) {
      let jsonResponse;

      if (this.sasjsConfig.serverType === ServerType.SAS9) {
        try {
          jsonResponse = JSON.parse(this.parseSAS9Response(response));
        } catch (e) {
          console.log(e);
        }
      } else {
        await this.parseSASVIYADebugResponse(response).then(
          (resText: any) => {
            try {
              jsonResponse = JSON.parse(resText);
            } catch (e) {
              console.log(e);
            }
          },
          (err: any) => {
            console.log(err);
          }
        );
      }

      if (jsonResponse) {
        return jsonResponse.WORK;
      }
    }
    return null;
  }

  public getSasRequests() {
    const sortedRequests = this.sasjsRequests.sort(compareTimestamps);
    return sortedRequests;
  }

  private setupConfiguration() {
    if (
      this.sasjsConfig.serverUrl === undefined ||
      this.sasjsConfig.serverUrl === ""
    ) {
      let url = `${location.protocol}//${location.hostname}`;
      if (location.port) {
        url = `${url}:${location.port}`;
      }
      this.sasjsConfig.serverUrl = url;
    }

    if (this.sasjsConfig.serverUrl.slice(-1) === "/") {
      this.sasjsConfig.serverUrl = this.sasjsConfig.serverUrl.slice(0, -1);
    }

    this.jobsPath =
      this.sasjsConfig.serverType === ServerType.SASViya
        ? this.sasjsConfig.pathSASViya
        : this.sasjsConfig.pathSAS9;
    this.loginUrl = `${this.sasjsConfig.serverUrl}/SASLogon/login`;
    this.logoutUrl =
      this.sasjsConfig.serverType === ServerType.SAS9
        ? "/SASLogon/logout?"
        : "/SASLogon/logout.do?";

    if (this.sasjsConfig.serverType === ServerType.SASViya) {
      this.sasViyaApiClient = new SASViyaApiClient(this.sasjsConfig.serverUrl);
    }
    if (this.sasjsConfig.serverType === ServerType.SAS9) {
      this.sas9ApiClient = new SAS9ApiClient(this.sasjsConfig.serverUrl);
    }
  }

  private setLoginUrl = (matches: RegExpExecArray) => {
    let parsedURL = matches[1].replace(/\?.*/, "");
    if (parsedURL[0] === "/") {
      parsedURL = parsedURL.substr(1);

      const tempLoginLink = this.sasjsConfig.serverUrl
        ? `${this.sasjsConfig.serverUrl}/${parsedURL}`
        : `${parsedURL}`;

      const loginUrl = tempLoginLink;

      this.loginUrl =
        this.sasjsConfig.serverType === ServerType.SASViya
          ? tempLoginLink
          : loginUrl.replace(".do", "");
    }
  };

  private async getLoginForm() {
    const pattern: RegExp = /<form.+action="(.*Logon[^"]*).*>/;
    const response = await fetch(this.loginUrl).then((r) => r.text());
    const matches = pattern.exec(response);
    const formInputs: any = {};
    if (matches && matches.length) {
      this.setLoginUrl(matches);
      const inputs = response.match(/<input.*"hidden"[^>]*>/g);
      if (inputs) {
        inputs.forEach((inputStr: string) => {
          const valueMatch = inputStr.match(/name="([^"]*)"\svalue="([^"]*)/);
          if (valueMatch && valueMatch.length) {
            formInputs[valueMatch[1]] = valueMatch[2];
          }
        });
      }
    }
    return Object.keys(formInputs).length ? formInputs : null;
  }
}
