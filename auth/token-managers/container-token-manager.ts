/**
 * Copyright 2021, 2022 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import logger from '../../lib/logger';
import { atLeastOne, readCrTokenFile } from '../utils';
import { IamRequestBasedTokenManager, IamRequestOptions } from './iam-request-based-token-manager';

const DEFAULT_CR_TOKEN_FILEPATH = '/var/run/secrets/tokens/vault-token';

/** Configuration options for IAM token retrieval. */
interface Options extends IamRequestOptions {
  crTokenFilename?: string;
  iamProfileName?: string;
  iamProfileId?: string;
}

/**
 * The ContainerTokenManager retrieves a compute resource token from a file on the container. This token
 * is used to perform the necessary interactions with the IAM token service to obtain and store a suitable
 * bearer (access) token.
 */
export class ContainerTokenManager extends IamRequestBasedTokenManager {
  private crTokenFilename: string;

  private iamProfileName: string;

  private iamProfileId: string;

  /**
   *
   * Create a new ContainerTokenManager instance.
   *
   * @param options - Configuration options.
   * This should be an object containing these fields:
   * - url: (optional) the endpoint URL for the token service (default: "https://iam.cloud.ibm.com")
   * - crTokenFilename: (optional) the file containing the compute resource token (default: "/var/run/secrets/tokens/vault-token")
   * - iamProfileName: (optional) the name of the IAM trusted profile associated with the compute resource token (required if iamProfileId is not specified)
   * - iamProfileId]: (optional) the ID of the IAM trusted profile associated with the compute resource token (required if iamProfileName is not specified)
   * - headers: (optional) a set of HTTP headers to be sent with each request to the token service
   * - disableSslVerification: (optional) a flag that indicates whether verification of the token server's SSL certificate
   * should be disabled or not
   * - clientId: (optional) the "clientId" and "clientSecret" fields are used to form a Basic
   * Authorization header to be included in each request to the token service
   * - clientSecret: (optional) the "clientId" and "clientSecret" fields are used to form a Basic
   * Authorization header to be included in each request to the token service
   *
   * @throws Error: the configuration options were invalid
   */
  constructor(options: Options) {
    // all parameters are optional
    options = options || ({} as Options);

    super(options);

    if (!atLeastOne(options.iamProfileId, options.iamProfileName)) {
      throw new Error('At least one of `iamProfileName` or `iamProfileId` must be specified.');
    }

    this.crTokenFilename = options.crTokenFilename || DEFAULT_CR_TOKEN_FILEPATH;

    if (options.iamProfileName) {
      this.iamProfileName = options.iamProfileName;
    }
    if (options.iamProfileId) {
      this.iamProfileId = options.iamProfileId;
    }

    // construct form data for the cr token use case of iam token management
    this.formData.grant_type = 'urn:ibm:params:oauth:grant-type:cr-token';
  }

  /**
   * Sets the "crTokenFilename" field
   * @param crTokenFilename - the name of the file containing the CR token
   */
  public setCrTokenFilename(crTokenFilename: string): void {
    this.crTokenFilename = crTokenFilename;
  }

  /**
   * Sets the name of the IAM trusted profile to use when obtaining an access token from the IAM token server.
   * @param iamProfileName - the name of the IAM trusted profile
   */
  public setIamProfileName(iamProfileName: string): void {
    this.iamProfileName = iamProfileName;
  }

  /**
   * Sets the ID of the IAM trusted profile to use when obtaining an access token from the IAM token server.
   * @param iamProfileId - the ID of the IAM trusted profile
   */
  public setIamProfileId(iamProfileId: string): void {
    this.iamProfileId = iamProfileId;
  }

  /**
   * Request an IAM token using a compute resource token.
   */
  protected async requestToken(): Promise<any> {
    const crToken = getCrToken(this.crTokenFilename);
    this.formData.cr_token = crToken;

    // these member variables can be reset, set them in the form data right
    // before making the request to ensure they're up to date
    if (this.iamProfileName) {
      this.formData.profile_name = this.iamProfileName;
    }
    if (this.iamProfileId) {
      this.formData.profile_id = this.iamProfileId;
    }

    return super.requestToken();
  }
}

function getCrToken(filename: string): string {
  logger.debug(`Attempting to read CR token from file: ${filename}`);

  // moving the actual read to another file to isolate usage of node-only packages like `fs`
  return readCrTokenFile(filename);
}
