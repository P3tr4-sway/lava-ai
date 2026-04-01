import { createHash, createHmac } from 'crypto'

const TENCENT_VOD_HOST = 'vod.tencentcloudapi.com'
const TENCENT_VOD_SERVICE = 'vod'
const TENCENT_VOD_VERSION = '2018-07-17'
const TENCENT_VOD_ACTION = 'CreateAigcApiToken'

export interface TencentVodAuthConfig {
  secretId: string
  secretKey: string
  subAppId: number
}

export async function createTencentVodApiToken(config: TencentVodAuthConfig): Promise<string> {
  const payload = JSON.stringify({ SubAppId: config.subAppId })
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const contentType = 'application/json; charset=utf-8'
  const canonicalHeaders = `content-type:${contentType}\nhost:${TENCENT_VOD_HOST}\n`
  const signedHeaders = 'content-type;host'
  const hashedPayload = sha256Hex(payload)
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n')
  const credentialScope = `${date}/${TENCENT_VOD_SERVICE}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')
  const secretDate = hmac(`TC3${config.secretKey}`, date)
  const secretService = hmac(secretDate, TENCENT_VOD_SERVICE)
  const secretSigning = hmac(secretService, 'tc3_request')
  const signature = hmac(secretSigning, stringToSign, 'hex')
  const authorization = [
    'TC3-HMAC-SHA256',
    `Credential=${config.secretId}/${credentialScope},`,
    `SignedHeaders=${signedHeaders},`,
    `Signature=${signature}`,
  ].join(' ')

  const response = await fetch(`https://${TENCENT_VOD_HOST}/`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      Host: TENCENT_VOD_HOST,
      'X-TC-Action': TENCENT_VOD_ACTION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': TENCENT_VOD_VERSION,
    },
    body: payload,
  })

  const result = (await response.json()) as {
    Response?: { ApiToken?: string; Error?: { Code?: string; Message?: string }; RequestId?: string }
  }

  if (!response.ok) {
    throw new Error(`Tencent VOD token request failed (${response.status})`)
  }

  if (result.Response?.Error) {
    throw new Error(
      `Tencent VOD token request failed: ${result.Response.Error.Code ?? 'UnknownError'} ${result.Response.Error.Message ?? ''}`.trim(),
    )
  }

  const apiToken = result.Response?.ApiToken
  if (!apiToken) {
    throw new Error('Tencent VOD token request did not return ApiToken')
  }

  return apiToken
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function hmac(key: string | Buffer, input: string, encoding?: 'hex'): Buffer | string {
  const digest = createHmac('sha256', key).update(input, 'utf8')
  return encoding ? digest.digest(encoding) : digest.digest()
}
