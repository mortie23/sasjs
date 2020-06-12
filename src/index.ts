import "isomorphic-fetch";
import * as e6p from "es6-promise";
(e6p as any).polyfill();
import * as NodeFormData from "form-data";

export interface SASjsRequest {
  serviceLink: string;
  timestamp: Date;
  sourceCode: string;
  generatedCode: string;
  logFile: string;
  SASWORK: any;
}

export interface SASjsWatingRequest {
  requestPromise: {
    promise: any;
    resolve: any;
    reject: any;
  };
  programName: string;
  data: any;
  params?: any;
}

export class SASjsConfig {
  serverUrl: string = "";
  pathSAS9: string = "";
  pathSASViya: string = "";
  appLoc: string = "";
  serverType: string = "";
  debug: boolean = true;
}

const defaultConfig: SASjsConfig = {
  serverUrl: "",
  pathSAS9: "/SASStoredProcess/do",
  pathSASViya: "/SASJobExecution",
  appLoc: "/Public/seedapp",
  serverType: "AUTODETECT",
  debug: true,
};

/**
 * SASjs is a JavaScript adapter for SAS.
 *
 */
export default class SASjs {
  private sasjsConfig = new SASjsConfig();
  private serverUrl: string = "";
  private jobsPath: string = "";
  private appLoc: string = "";
  private logoutUrl: string = "";
  private loginUrl: string = "";
  private _csrf: string | null = null;
  private retryCount: number = 0;
  private retryLimit: number = 5;
  private sasjsRequests: SASjsRequest[] = [];
  private sasjsWaitingRequests: SASjsWatingRequest[] = [];
  private userName: string = "";

  constructor(config?: any) {
    this.sasjsConfig = {
      ...defaultConfig,
      ...config,
    };

    this.setupConfiguration();
  }

  public async detectServerType() {
    return new Promise((resolve, reject) => {
      let viyaApi = this.sasjsConfig.serverUrl + "/reports/reports?limit=1";

      fetch(viyaApi)
        .then((res: any) => {
          this.sasjsConfig.serverType = res.status === 404 ? "SAS9" : "SASVIYA";
          console.log("Server type detected:", this.sasjsConfig.serverType);
          resolve();
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  public async executeScriptSAS9(
    linesOfCode: string[],
    serverName: string,
    repositoryName: string
  ) {
    const requestPayload = linesOfCode.join("\n");
    const executeScriptRequest = {
      method: "PUT",
      headers: {
        Accept: "application/json",
      },
      body: `command=${requestPayload}`,
    };
    const executeScriptResponse = await fetch(
      `${this.sasjsConfig.serverUrl}/sas/servers/${serverName}/cmd?repositoryName=${repositoryName}`,
      executeScriptRequest
    ).then((res) => res.text());

    return executeScriptResponse;
  }

  public async getAllContexts(accessToken: string) {
    const contexts = await fetch(
      `${this.sasjsConfig.serverUrl}/compute/contexts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    ).then((res) => res.json());
    const contextsList = contexts && contexts.items ? contexts.items : [];
    return contextsList.map((context: any) => ({
      createdBy: context.createdBy,
      id: context.id,
      name: context.name,
      version: context.version,
      attributes: {},
    }));
  }

  public async getExecutableContexts(accessToken: string) {
    const contexts = await fetch(
      `${this.sasjsConfig.serverUrl}/compute/contexts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    ).then((res) => res.json());
    const contextsList = contexts && contexts.items ? contexts.items : [];
    const executableContexts: any[] = [];
    await asyncForEach(contextsList, async (context: any) => {
      const linesOfCode = ["%put &=sysuserid;"];
      const result = await this.executeScriptSASViya(
        `test-${context.name}`,
        linesOfCode,
        context.name,
        accessToken
      ).catch(() => null);
      if (result && result.jobStatus === "completed") {
        let sysUserId = "";
        if (result && result.log && result.log.items) {
          const sysUserIdLog = result.log.items.find((i: any) =>
            i.line.startsWith("SYSUSERID=")
          );
          if (sysUserIdLog) {
            sysUserId = sysUserIdLog.line.replace("SYSUSERID=", "");
          }
        }

        executableContexts.push({
          createdBy: context.createdBy,
          id: context.id,
          name: context.name,
          version: context.version,
          attributes: {
            sysUserId,
          },
        });
      }
    });

    return executableContexts;
  }

  public async createSession(contextName: string, accessToken: string) {
    const contexts = await fetch(
      `${this.sasjsConfig.serverUrl}/compute/contexts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    ).then((res) => res.json());
    const executionContext =
      contexts.items && contexts.items.length
        ? contexts.items.find((c: any) => c.name === contextName)
        : null;
    if (!executionContext) {
      throw new Error(`Execution context ${contextName} not found.`);
    }

    const createSessionRequest = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    };
    const createdSession = await fetch(
      `${this.sasjsConfig.serverUrl}/compute/contexts/${executionContext.id}/sessions`,
      createSessionRequest
    ).then((res) => res.json());

    return createdSession;
  }

  public async executeScriptSASViya(
    fileName: string,
    linesOfCode: string[],
    contextName: string,
    accessToken: string,
    sessionId = ""
  ) {
    const contexts = await fetch(
      `${this.sasjsConfig.serverUrl}/compute/contexts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    ).then((res) => res.json());
    const executionContext =
      contexts.items && contexts.items.length
        ? contexts.items.find((c: any) => c.name === contextName)
        : null;

    if (executionContext) {
      // Request new session in context or use the ID passed in
      let executionSessionId;
      if (sessionId) {
        executionSessionId = sessionId;
      } else {
        const createSessionRequest = {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        };
        const createdSession = await fetch(
          `${this.sasjsConfig.serverUrl}/compute/contexts/${executionContext.id}/sessions`,
          createSessionRequest
        ).then((res) => res.json());
        executionSessionId = createdSession.id;
      }
      // Execute job in session
      const postJobRequest = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fileName,
          description: "Powered by SASjs",
          code: linesOfCode,
        }),
      };
      const postedJob = await fetch(
        `${this.sasjsConfig.serverUrl}/compute/sessions/${executionSessionId}/jobs`,
        postJobRequest
      ).then((res) => res.json());
      console.log(`Job has been submitted for ${fileName}`);
      console.log(
        `You can monitor the job progress at ${this.sasjsConfig.serverUrl}${
          postedJob.links.find((l: any) => l.rel === "state").href
        }`
      );

      const jobStatus = await this.pollJobState(postedJob, accessToken);
      const logLink = postedJob.links.find((l: any) => l.rel === "log");
      if (logLink) {
        const log = await fetch(
          `${this.sasjsConfig.serverUrl}${logLink.href}?limit=100000`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        ).then((res) => res.json());
        return { jobStatus, log };
      }
    } else {
      console.log(
        `Unable to find execution context ${contextName}.\nPlease check the contextName in the tgtDeployVars and try again.`
      );
      console.log("Response from server: ", JSON.stringify(contexts));
    }
  }

  private async pollJobState(postedJob: any, accessToken: string) {
    let postedJobState = "";
    let pollCount = 0;
    const stateLink = postedJob.links.find((l: any) => l.rel === "state");
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        if (
          postedJobState === "running" ||
          postedJobState === "" ||
          postedJobState === "pending"
        ) {
          if (stateLink) {
            console.log("Polling job status... \n");
            const jobState = await fetch(
              `${this.sasjsConfig.serverUrl}${stateLink.href}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
              }
            ).then((res) => res.text());
            postedJobState = jobState.trim();
            console.log(`Current state: ${postedJobState}\n`);
            pollCount++;
            if (pollCount >= 100) {
              resolve(postedJobState);
            }
          }
        } else {
          clearInterval(interval);
          resolve(postedJobState);
        }
      }, 3000);
    });
  }

  public async getAuthCode(clientId: string) {
    const authUrl = `${this.sasjsConfig.serverUrl}/SASLogon/oauth/authorize?client_id=${clientId}&response_type=code`;

    const authCode = await fetch(authUrl, {
      referrerPolicy: "same-origin",
      credentials: "include",
    })
      .then((response) => response.text())
      .then(async (response) => {
        if (this.isAuthorizeFormRequired(response)) {
          let authcode = "";
          let formResponse: any = await this.parseAndSubmitAuthorizeForm(
            response
          );

          let responseBody = formResponse
            .split("<body>")[1]
            .split("</body>")[0];
          let bodyElement: any = document.createElement("div");
          bodyElement.innerHTML = responseBody;

          authcode = bodyElement.querySelector(".infobox h4").innerText;

          return authcode;
        } else {
          let authCode: string = "";
          const responseBody = response.split("<body>")[1].split("</body>")[0];
          const bodyElement: any = document.createElement("div");
          bodyElement.innerHTML = responseBody;

          if (bodyElement) {
            authCode = bodyElement.querySelector(".infobox h4").innerText;
          }

          return authCode;
        }
      })
      .catch(() => null);

    return authCode;
  }

  public async getAccessToken(
    clientId: string,
    clientSecret: string,
    authCode: string
  ) {
    const url = this.sasjsConfig.serverUrl + "/SASLogon/oauth/token";
    let token;
    if (typeof Buffer === "undefined") {
      token = btoa(clientId + ":" + clientSecret);
    } else {
      token = Buffer.from(clientId + ":" + clientSecret).toString("base64");
    }
    const headers = {
      Authorization: "Basic " + token,
    };

    let formData;
    if (typeof FormData === "undefined") {
      formData = new NodeFormData();
      formData.append("grant_type", "authorization_code");
      formData.append("code", authCode);
    } else {
      formData = new FormData();
      formData.append("grant_type", "authorization_code");
      formData.append("code", authCode);
    }

    const authResponse = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers,
      body: formData as any,
      referrerPolicy: "same-origin",
    }).then((res) => res.json());

    return authResponse;
  }

  public async refreshTokens(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ) {
    const url = this.sasjsConfig.serverUrl + "/SASLogon/oauth/token";
    let token;
    if (typeof Buffer === "undefined") {
      token = btoa(clientId + ":" + clientSecret);
    } else {
      token = Buffer.from(clientId + ":" + clientSecret).toString("base64");
    }
    const headers = {
      Authorization: "Basic " + token,
    };

    let formData;
    if (typeof FormData === "undefined") {
      formData = new NodeFormData();
      formData.append("grant_type", "refresh_token");
      formData.append("refresh_token", refreshToken);
    } else {
      formData = new FormData();
      formData.append("grant_type", "refresh_token");
      formData.append("refresh_token", refreshToken);
    }

    const authResponse = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers,
      body: formData as any,
      referrerPolicy: "same-origin",
    }).then((res) => res.json());

    return authResponse;
  }

  public async deleteClient(clientId: string, accessToken: string) {
    const url = this.sasjsConfig.serverUrl + `/oauth/clients/${clientId}`;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    const deleteResponse = await fetch(url, {
      method: "DELETE",
      credentials: "include",
      headers,
    }).then((res) => res.text());

    return deleteResponse;
  }

  /**
   * Returns the current SASjs configuration.
   *
   */
  public async getSasjsConfig() {
    if (
      this.sasjsConfig.serverType !== "SASVIYA" &&
      this.sasjsConfig.serverType !== "SAS9"
    ) {
      await this.detectServerType();
    }
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
    const loginResponse = await fetch(this.loginUrl);
    const responseText = await loginResponse.text();
    const isLoginRequired = this.isLogInRequired(responseText);

    return Promise.resolve({
      isLoggedIn: !isLoginRequired,
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
        let isLoggedIn;

        if (this.isAuthorizeFormRequired(responseText)) {
          authFormRes = await this.parseAndSubmitAuthorizeForm(responseText);
          isLoggedIn = authFormRes.includes(
            "Authentication success, retry original request"
          );
        } else {
          isLoggedIn = this.isLogInSuccess(responseText);
          if (!isLoggedIn) isLoggedIn = !this.isLogInRequired(responseText);
        }

        if (isLoggedIn) {
          this.resendWaitingRequests();
        }

        return {
          isLoggedIn: isLoggedIn,
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
      const logOutURL = `${this.serverUrl}${this.logoutUrl}`;
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
    const program = this.appLoc
      ? this.appLoc.replace(/\/?$/, "/") + programName.replace(/^\//, "")
      : programName;
    const apiUrl = `${this.serverUrl}${this.jobsPath}/?_program=${program}`;

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
      if (this.sasjsConfig.serverType === "SAS9") {
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
            let csvChunks = splitChunks(csv);
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

    let sasjsWaitingRequest: SASjsWatingRequest = {
      requestPromise: {
        promise: null,
        resolve: null,
        reject: null,
      },
      programName: programName,
      data: data,
      params: params,
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

            if (response.redirected && this.sasjsConfig.serverType === "SAS9") {
              isRedirected = true;
            }

            return response.text();
          })
          .then((responseText) => {
            if (
              (this.needsRetry(responseText) || isRedirected) &&
              !this.isLogInRequired(responseText)
            ) {
              if (this.retryCount < this.retryLimit) {
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

              if (self.isLogInRequired(responseText)) {
                if (loginRequiredCallback) loginRequiredCallback(true);
                logInRequired = true;
                sasjsWaitingRequest.requestPromise.resolve = resolve;
                sasjsWaitingRequest.requestPromise.reject = reject;
                this.sasjsWaitingRequests.push(sasjsWaitingRequest);
              } else {
                if (
                  this.sasjsConfig.serverType === "SAS9" &&
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
                  this.sasjsConfig.serverType === "SASVIYA" &&
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
                    let parsedJson = JSON.parse(responseText);
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
    for (let sasjsWaitingRequest of this.sasjsWaitingRequests) {
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

  private needsRetry(responseText: string): boolean {
    return (
      (responseText.includes('"errorCode":403') &&
        responseText.includes("_csrf") &&
        responseText.includes("X-CSRF-TOKEN")) ||
      (responseText.includes('"status":403') &&
        responseText.includes('"error":"Forbidden"')) ||
      (responseText.includes('"status":449') &&
        responseText.includes("Authentication success, retry original request"))
    );
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
      if (this.sasjsConfig.serverType === "SAS9") {
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
      const iframe_start = response.split(
        '<iframe style="width: 99%; height: 500px" src="'
      )[1];
      const json_url = iframe_start
        ? iframe_start.split('"></iframe>')[0]
        : null;

      if (json_url) {
        fetch(this.serverUrl + json_url)
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
    let logLines = response.split("\n");
    let parsedLines: string[] = [];
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
    if (this.sasjsConfig.serverType === "SAS9") {
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
      sourceCode = this.parseSourceCode(response);
      generatedCode = this.parseGeneratedCode(response);
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

      if (this.sasjsConfig.serverType === "SAS9") {
        try {
          jsonResponse = JSON.parse(this.parseSAS9Response(response));
        } catch (e) {}
      } else {
        await this.parseSASVIYADebugResponse(response).then(
          (resText: any) => {
            try {
              jsonResponse = JSON.parse(resText);
            } catch (e) {}
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

  private parseSourceCode(log: string) {
    const isSourceCodeLine = (line: string) =>
      line.trim().substring(0, 10).trimStart().match(/^\d/);
    const logLines = log.split("\n").filter(isSourceCodeLine);
    return logLines.join("\r\n");
  }

  private parseGeneratedCode(log: string) {
    let startsWith = "MPRINT";
    const isGeneratedCodeLine = (line: string) =>
      line.trim().startsWith(startsWith);
    const logLines = log.split("\n").filter(isGeneratedCodeLine);
    return logLines.join("\r\n");
  }

  public getSasRequests() {
    const sortedRequests = this.sasjsRequests.sort(compareTimestamps);
    return sortedRequests;
  }

  private async setupConfiguration() {
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

    if (
      this.sasjsConfig.serverType !== "SASVIYA" &&
      this.sasjsConfig.serverType !== "SAS9"
    )
      await this.detectServerType();

    this.serverUrl = this.sasjsConfig.serverUrl;
    this.jobsPath =
      this.sasjsConfig.serverType === "SASVIYA"
        ? this.sasjsConfig.pathSASViya
        : this.sasjsConfig.pathSAS9;
    this.appLoc = this.sasjsConfig.appLoc;
    this.loginUrl = `${this.serverUrl}/SASLogon/login`;
    this.logoutUrl =
      this.sasjsConfig.serverType === "SAS9"
        ? "/SASLogon/logout?"
        : "/SASLogon/logout.do?";
  }

  private setLoginUrl = (matches: RegExpExecArray) => {
    let parsedURL = matches[1].replace(/\?.*/, "");
    if (parsedURL[0] === "/") {
      parsedURL = parsedURL.substr(1);

      const tempLoginLink = this.serverUrl
        ? `${this.serverUrl}/${parsedURL}`
        : `${parsedURL}`;

      let loginUrl = tempLoginLink;
      if (this.sasjsConfig.serverType === "SAS9") {
        loginUrl = this.getSas9LoginUrl(tempLoginLink);
      }

      this.loginUrl = loginUrl;
    }
  };

  private getSas9LoginUrl = (loginUrl: string) => {
    const tempLoginLinkArray = loginUrl.split(".");
    const doIndex = tempLoginLinkArray.indexOf("do");

    if (doIndex > -1) {
      tempLoginLinkArray.splice(doIndex, 1);
    }

    return tempLoginLinkArray.join(".");
  };

  public isAuthorizeFormRequired(response: any) {
    return /<form.+action="(.*Logon\/oauth\/authorize[^"]*).*>/gm.test(
      response
    );
  }

  public async parseAndSubmitAuthorizeForm(response: any) {
    let authUrl: string | null = null;
    let params: any = {};

    let responseBody = response.split("<body>")[1].split("</body>")[0];
    let bodyElement = document.createElement("div");
    bodyElement.innerHTML = responseBody;

    let form = bodyElement.querySelector("#application_authorization");
    authUrl = form
      ? this.sasjsConfig.serverUrl + form.getAttribute("action")
      : null;

    let inputs: any = form?.querySelectorAll("input");

    for (let input of inputs) {
      if (input.name === "user_oauth_approval") {
        input.value = "true";
      }

      params[input.name] = input.value;
    }

    let formData = new FormData();

    for (const key in params) {
      if (params.hasOwnProperty(key)) {
        formData.append(key, params[key]);
      }
    }

    return new Promise((resolve, reject) => {
      if (authUrl) {
        fetch(authUrl, {
          method: "POST",
          credentials: "include",
          body: formData,
          referrerPolicy: "same-origin",
        })
          .then((res) => res.text())
          .then((res) => {
            resolve(res);
          });
      } else {
        reject("Auth form url is null");
      }
    });
  }

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

  private isLogInSuccess = (response: any) =>
    /You have signed in/gm.test(response);

  private isLogInRequired = (response: any) => {
    const pattern: RegExp = /<form.+action="(.*Logon[^"]*).*>/gm;
    const matches = pattern.test(response);
    return matches;
  };
}

const compareTimestamps = (a: SASjsRequest, b: SASjsRequest) => {
  return b.timestamp.getTime() - a.timestamp.getTime();
};

function splitChunks(string: string) {
  let size = 16000;

  var numChunks = Math.ceil(string.length / size),
    chunks = new Array(numChunks);

  for (var i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = string.substr(o, size);
  }

  return chunks;
}

function getByteSize(str: string) {
  var s = str.length;
  for (var i = str.length - 1; i >= 0; i--) {
    var code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) s++;
    else if (code > 0x7ff && code <= 0xffff) s += 2;
    if (code >= 0xdc00 && code <= 0xdfff) i--; //trail surrogate
  }
  return s;
}

function serialize(obj: any) {
  const str: any[] = [];
  for (const p in obj) {
    if (obj.hasOwnProperty(p)) {
      if (obj[p] instanceof Array) {
        for (let i = 0, n = obj[p].length; i < n; i++) {
          str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p][i]));
        }
      } else {
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
      }
    }
  }
  return str.join("&");
}

function convertToCSV(data: any) {
  const replacer = (key: any, value: any) => (value === null ? "" : value);
  const headerFields = Object.keys(data[0]);
  let csvTest;
  let invalidString = false;
  const headers = headerFields.map((field) => {
    let firstFoundType: string | null = null;
    let hasMixedTypes: boolean = false;
    let rowNumError: number = -1;

    const longestValueForField = data
      .map((row: any, index: number) => {
        if (row[field] || row[field] === "") {
          if (firstFoundType) {
            let currentFieldType =
              row[field] === "" || typeof row[field] === "string"
                ? "chars"
                : "number";

            if (!hasMixedTypes) {
              hasMixedTypes = currentFieldType !== firstFoundType;
              rowNumError = hasMixedTypes ? index + 1 : -1;
            }
          } else {
            if (row[field] === "") {
              firstFoundType = "chars";
            } else {
              firstFoundType =
                typeof row[field] === "string" ? "chars" : "number";
            }
          }

          let byteSize;

          if (typeof row[field] === "string") {
            let doubleQuotesFound = row[field]
              .split("")
              .filter((char: any) => char === '"');

            byteSize = getByteSize(row[field]);

            if (doubleQuotesFound.length > 0) {
              byteSize += doubleQuotesFound.length;
            }
          }

          return byteSize;
        }
      })
      .sort((a: number, b: number) => b - a)[0];
    if (longestValueForField && longestValueForField > 32765) {
      invalidString = true;
    }
    if (hasMixedTypes) {
      console.error(
        `Row (${rowNumError}), Column (${field}) has mixed types: ERROR`
      );
    }

    return `${field}:${firstFoundType === "chars" ? "$" : ""}${
      longestValueForField
        ? longestValueForField
        : firstFoundType === "chars"
        ? "1"
        : "best"
    }.`;
  });

  if (invalidString) {
    return "ERROR: LARGE STRING LENGTH";
  }
  csvTest = data.map((row: any) => {
    const fields = Object.keys(row).map((fieldName, index) => {
      let value;
      let containsSpecialChar = false;
      const currentCell = row[fieldName];

      if (JSON.stringify(currentCell).search(/(\\t|\\n|\\r)/gm) > -1) {
        value = currentCell.toString();
        containsSpecialChar = true;
      } else {
        value = JSON.stringify(currentCell, replacer);
      }

      value = value.replace(/\\\\/gm, "\\");

      if (containsSpecialChar) {
        if (value.includes(",") || value.includes('"')) {
          value = '"' + value + '"';
        }
      } else {
        if (
          !value.includes(",") &&
          value.includes('"') &&
          !value.includes('\\"')
        ) {
          value = value.substring(1, value.length - 1);
        }

        value = value.replace(/\\"/gm, '""');
      }

      value = value.replace(/\r\n/gm, "\n");

      if (value === "" && headers[index].includes("best")) {
        value = ".";
      }

      return value;
    });
    return fields.join(",");
  });

  let finalCSV =
    headers.join(",").replace(/,/g, " ") + "\r\n" + csvTest.join("\r\n");

  return finalCSV;
}

async function asyncForEach(array: any[], callback: any) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
