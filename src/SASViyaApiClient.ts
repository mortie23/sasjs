import {
  isAuthorizeFormRequired,
  parseAndSubmitAuthorizeForm,
  convertToCSV,
  makeRequest,
} from "./utils";
import * as NodeFormData from "form-data";
import * as path from "path";
import { Job, Session, Context } from "./types";

/**
 * A client for interfacing with the SAS Viya REST API
 *
 */
export class SASViyaApiClient {
  constructor(
    private serverUrl: string,
    private jobMap = new Map<string, Job[]>()
  ) {}
  private csrfToken: { headerName: string; value: string } | null = null;

  /**
   * Returns all available compute contexts on this server.
   * @param accessToken - an access token for an authorized user.
   */
  public async getAllContexts(accessToken?: string) {
    const headers: any = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const contexts = await fetch(
      `${this.serverUrl}/compute/contexts`,
      headers
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

  /**
   * Returns all compute contexts on this server that the user has access to.
   * @param accessToken - an access token for an authorized user.
   */
  public async getExecutableContexts(accessToken?: string) {
    const headers: any = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const contexts = await fetch(
      `${this.serverUrl}/compute/contexts`,
      headers
    ).then((res) => res.json());
    const contextsList = contexts && contexts.items ? contexts.items : [];
    const executableContexts: any[] = [];

    const promises = contextsList.map((context: any) => {
      const linesOfCode = ["%put &=sysuserid;"];
      return this.executeScript(
        `test-${context.name}`,
        linesOfCode,
        context.name,
        accessToken,
        undefined,
        true
      ).catch(() => null);
    });
    const results = await Promise.all(promises);
    results.forEach((result: any, index: number) => {
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
          createdBy: contextsList[index].createdBy,
          id: contextsList[index].id,
          name: contextsList[index].name,
          version: contextsList[index].version,
          attributes: {
            sysUserId,
          },
        });
      }
    });

    return executableContexts;
  }

  /**
   * Creates a session on the given context.
   * @param contextName - the name of the context to create a session on.
   * @param accessToken - an access token for an authorized user.
   */
  public async createSession(contextName: string, accessToken: string) {
    const contexts = await fetch(`${this.serverUrl}/compute/contexts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());
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
      `${this.serverUrl}/compute/contexts/${executionContext.id}/sessions`,
      createSessionRequest
    ).then((res) => res.json());

    return createdSession;
  }

  /**
   * Executes code on the current SAS Viya server.
   * @param fileName - a name for the file being submitted for execution.
   * @param linesOfCode - an array of lines of code to execute.
   * @param contextName - the context to execute the code in.
   * @param accessToken - an access token for an authorized user.
   * @param sessionId - optional session ID to reuse.
   * @param silent - optional flag to turn of logging.
   */
  public async executeScript(
    fileName: string,
    linesOfCode: string[],
    contextName: string,
    accessToken?: string,
    sessionId = "",
    silent = false
  ) {
    const headers: any = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    if (this.csrfToken) {
      headers[this.csrfToken.headerName] = this.csrfToken.value;
    }
    const contexts = await this.request<{ items: Context[] }>(
      `${this.serverUrl}/compute/contexts`,
      { headers }
    );
    const executionContext =
      contexts.items && contexts.items.length
        ? contexts.items.find((c: any) => c.name === contextName)
        : null;

    if (executionContext) {
      // Request new session in context or use the ID passed in
      let executionSessionId: string;
      if (sessionId) {
        executionSessionId = sessionId;
      } else {
        const createSessionRequest = {
          method: "POST",
          headers,
        };
        const createdSession = await this.request<Session>(
          `${this.serverUrl}/compute/contexts/${executionContext.id}/sessions`,
          createSessionRequest
        );

        executionSessionId = createdSession.id;
      }
      // Execute job in session
      const postJobRequest = {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: fileName,
          description: "Powered by SASjs",
          code: linesOfCode,
        }),
      };
      const postedJob = await this.request<Job>(
        `${this.serverUrl}/compute/sessions/${executionSessionId}/jobs`,
        postJobRequest
      );
      if (!silent) {
        console.log(`Job has been submitted for ${fileName}`);
        console.log(
          `You can monitor the job progress at ${this.serverUrl}${
            postedJob.links.find((l: any) => l.rel === "state")!.href
          }`
        );
      }

      const jobStatus = await this.pollJobState(postedJob, accessToken, silent);
      const logLink = postedJob.links.find((l: any) => l.rel === "log");
      if (logLink) {
        const log = await fetch(
          `${this.serverUrl}${logLink.href}?limit=100000`,
          {
            headers,
          }
        ).then((res) => res.json());
        return { jobStatus, log };
      }
    } else {
      console.error(
        `Unable to find execution context ${contextName}.\nPlease check the contextName in the tgtDeployVars and try again.`
      );
      console.error("Response from server: ", JSON.stringify(contexts));
    }
  }

  /**
   * Performs a login redirect and returns an auth code for the given client
   * @param clientId - the client ID to authenticate with.
   */
  public async getAuthCode(clientId: string) {
    const authUrl = `${this.serverUrl}/SASLogon/oauth/authorize?client_id=${clientId}&response_type=code`;

    const authCode = await fetch(authUrl, {
      referrerPolicy: "same-origin",
      credentials: "include",
    })
      .then((response) => response.text())
      .then(async (response) => {
        let code = "";
        if (isAuthorizeFormRequired(response)) {
          const formResponse: any = await parseAndSubmitAuthorizeForm(
            response,
            this.serverUrl
          );

          const responseBody = formResponse
            .split("<body>")[1]
            .split("</body>")[0];
          const bodyElement: any = document.createElement("div");
          bodyElement.innerHTML = responseBody;

          code = bodyElement.querySelector(".infobox h4").innerText;

          return code;
        } else {
          const responseBody = response.split("<body>")[1].split("</body>")[0];
          const bodyElement: any = document.createElement("div");
          bodyElement.innerHTML = responseBody;

          if (bodyElement) {
            code = bodyElement.querySelector(".infobox h4").innerText;
          }

          return code;
        }
      })
      .catch(() => null);

    return authCode;
  }

  /**
   * Exchanges the auth code for an access token for the given client.
   * @param clientId - the client ID to authenticate with.
   * @param clientSecret - the client secret to authenticate with.
   * @param authCode - the auth code received from the server.
   */
  public async getAccessToken(
    clientId: string,
    clientSecret: string,
    authCode: string
  ) {
    const url = this.serverUrl + "/SASLogon/oauth/token";
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

  /**
   * Exchanges the refresh token for an access token for the given client.
   * @param clientId - the client ID to authenticate with.
   * @param clientSecret - the client secret to authenticate with.
   * @param authCode - the refresh token received from the server.
   */
  public async refreshTokens(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ) {
    const url = this.serverUrl + "/SASLogon/oauth/token";
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

  /**
   * Deletes the client representing the supplied ID.
   * @param clientId - the client ID to authenticate with.
   * @param accessToken - an access token for an authorized user.
   */
  public async deleteClient(clientId: string, accessToken: string) {
    const url = this.serverUrl + `/oauth/clients/${clientId}`;

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

  public async postJob(
    appLoc: string,
    jobPath: string,
    data?: any,
    accessToken?: string
  ) {
    if (!this.jobMap.size) {
      await this.populateJobMap(appLoc, accessToken);
    }
    if (!this.jobMap.size) {
      throw new Error(
        `The job ${jobPath} was not found at the appLoc ${appLoc}`
      );
    }

    let files: any[] = [];
    if (data && Object.keys(data).length) {
      files = await this.uploadTables(data, accessToken);
      console.log(files);
    }
    const jobName = path.basename(jobPath);
    const jobFolder = jobPath.replace(`/${jobName}`, "");
    const allJobsInFolder = this.jobMap.get(jobFolder);
    if (allJobsInFolder) {
      const jobSpec = allJobsInFolder.find((j: Job) => j.name === jobName);
      const jobDefinitionLink = jobSpec?.links.find(
        (l) => l.rel === "getResource"
      )?.href;
      const requestInfo: any = {
        method: "GET",
      };
      const headers: any = { "Content-Type": "application/json" };
      if (!!accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      requestInfo.headers = headers;
      const jobDefinition = await fetch(
        `${this.serverUrl}${jobDefinitionLink}`,
        requestInfo
      ).then((res) => res.json());
      const args: { [key: string]: any } = {
        _contextName: "SharedCompute",
        _program: `${appLoc}/${jobPath}`,
        _webin_file_count: files.length,
        _debug: true,
      };

      files.forEach((fileInfo, index) => {
        args[`_webin_fileuri${index + 1}`] = `/files/files/${fileInfo.file.id}`;
        args[`_webin_name${index + 1}`] = fileInfo.tableName;
      });

      const postJobRequest = {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: `exec-${jobName}`,
          description: "Powered by SASjs",
          jobDefinition,
          arguments: args,
        }),
      };
      const postedJob = await fetch(
        `${this.serverUrl}/jobExecution/jobs`,
        postJobRequest
      ).then((response) => {
        if (!response.ok) {
          if (response.status === 403) {
            const tokenHeader = response.headers.get("X-CSRF-HEADER");

            if (tokenHeader) {
              const token = response.headers.get(tokenHeader);
              this.csrfToken = { headerName: tokenHeader, value: token || "" };

              const retryRequest = {
                ...postJobRequest,
                headers: { ...headers, [tokenHeader]: token },
              };
              return fetch(
                `${this.serverUrl}/jobExecution/jobs`,
                retryRequest
              ).then((res) => res.json());
            }
          }
        } else {
          return response.json();
        }
      });
      const jobStatus = await this.pollJobState(postedJob, accessToken);
      const logLink = postedJob.links.find((l: any) => l.rel === "log");
      if (logLink) {
        const log = await fetch(`${this.serverUrl}${logLink.href}`, {
          headers,
        }).then((response) => response.json());
        return { jobStatus, log };
      } else {
        return postedJob;
      }
    }
    throw new Error(`The job ${jobPath} was not found at the appLoc ${appLoc}`);
  }

  public async populateJobMap(folderName: string, accessToken?: string) {
    const allFiles = new Map<string, Job[]>();
    const url = "/folders/folders/@item?path=" + folderName;
    const requestInfo: any = {
      method: "GET",
    };
    if (accessToken) {
      requestInfo.headers = { Authorization: `Bearer ${accessToken}` };
    }
    const folder = await fetch(
      `${this.serverUrl}${url}`,
      requestInfo
    ).then((res) => res.json());
    const members = await fetch(
      `${this.serverUrl}/folders/folders/${folder.id}/members`,
      requestInfo
    ).then((res) => res.json());

    const jobsAtRoot = members.items.filter(
      (m: any) => m.contentType === "jobDefinition"
    );
    allFiles.set("", jobsAtRoot);
    const subfolderRequests = members.items
      .filter((i: any) => i.contentType === "folder")
      .map(async (member: any) => {
        const subFolderUrl =
          "/folders/folders/@item?path=" + folderName + "/" + member.name;
        const memberDetail = await fetch(
          `${this.serverUrl}${subFolderUrl}`,
          requestInfo
        ).then((res) => res.json());
        const membersLink = memberDetail.links.find(
          (l: any) => l.rel === "members"
        );
        const memberContents = await fetch(
          `${this.serverUrl}${membersLink.href}`,
          requestInfo
        ).then((res) => res.json());
        const jobsInFolder = memberContents.items.filter(
          (i: any) => i.contentType === "jobDefinition"
        ) as any[];
        allFiles.set(member.name, jobsInFolder);
        return jobsInFolder;
      });
    await Promise.all(subfolderRequests);

    this.jobMap = allFiles;
  }

  private async pollJobState(
    postedJob: any,
    accessToken?: string,
    silent = false
  ) {
    let postedJobState = "";
    let pollCount = 0;
    const headers: any = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const stateLink = postedJob.links.find((l: any) => l.rel === "state");
    return new Promise((resolve, _) => {
      const interval = setInterval(async () => {
        if (
          postedJobState === "running" ||
          postedJobState === "" ||
          postedJobState === "pending"
        ) {
          if (stateLink) {
            if (!silent) {
              console.log("Polling job status... \n");
            }
            const jobState = await fetch(`${this.serverUrl}${stateLink.href}`, {
              headers,
            }).then((res) => res.text());
            postedJobState = jobState.trim();
            if (!silent) {
              console.log(`Current state: ${postedJobState}\n`);
            }
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

  private async uploadTables(data: any, accessToken?: string) {
    const uploadedFiles = [];
    let index = 0;
    const headers: any = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    if (this.csrfToken) {
      headers[this.csrfToken.headerName] = this.csrfToken.value;
    }
    for (const tableName in data) {
      const csv = convertToCSV(data[tableName]);
      if (csv === "ERROR: LARGE STRING LENGTH") {
        throw new Error(
          "The max length of a string value in SASjs is 32765 characters."
        );
      }

      const createFileRequest = {
        method: "POST",
        body: csv,
        headers,
      };

      const file = await fetch(
        `${this.serverUrl}/files/files#rawUpload`,
        createFileRequest
      ).then((response) => {
        if (!response.ok) {
          if (response.status === 403) {
            const tokenHeader = response.headers.get("X-CSRF-HEADER");

            if (tokenHeader) {
              const token = response.headers.get(tokenHeader);
              this.csrfToken = { headerName: tokenHeader, value: token || "" };

              const retryRequest = {
                ...createFileRequest,
                headers: { ...headers, [tokenHeader]: token },
              };
              return fetch(
                `${this.serverUrl}/files/files#rawUpload`,
                retryRequest
              ).then((res) => res.json());
            }
          }
        } else {
          return response.json();
        }
      });
      uploadedFiles.push({ tableName, file });
      index++;
    }
    return uploadedFiles;
  }
  private async request<T>(url: string, options: RequestInit) {
    return await makeRequest<T>(
      url,
      options,
      (csrfToken) => (this.csrfToken = csrfToken)
    );
  }
}
