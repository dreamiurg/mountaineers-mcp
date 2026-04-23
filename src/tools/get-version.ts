import { SERVER_NAME, SERVER_VERSION } from "../version.js";

export interface GetVersionResult {
  name: string;
  version: string;
}

export function getVersion(): GetVersionResult {
  return { name: SERVER_NAME, version: SERVER_VERSION };
}
