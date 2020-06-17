import { ServerType } from "./ServerType";

/**
 * Specifies the configuration for the SASjs instance.
 *
 */
export class SASjsConfig {
  serverUrl: string = "";
  pathSAS9: string = "";
  pathSASViya: string = "";
  appLoc: string = "";
  serverType: ServerType | null = null;
  debug: boolean = true;
}
