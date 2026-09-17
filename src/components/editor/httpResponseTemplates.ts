/**
 * HTTP 响应节点预设模板。
 * 选择后写入 statusCode + body；文案由 i18n 提供。
 */

/** 模板 id（与 i18n forms.httpResponse.templates.* 对应） */
export type HttpResponseTemplateId =
  | 'errorDetail'
  | 'errorNode'
  | 'returnMsg'
  | 'successWrap'
  | 'emptyOk'
  | 'unauthorized'
  | 'notFound'

export interface HttpResponseTemplate {
  id: HttpResponseTemplateId
  statusCode: number
  /** 按当前语言生成响应体 */
  body: (t: (key: string) => string) => string
}

/** 下拉选项顺序 */
export const HTTP_RESPONSE_TEMPLATE_IDS: HttpResponseTemplateId[] = [
  'errorDetail',
  'errorNode',
  'returnMsg',
  'successWrap',
  'emptyOk',
  'unauthorized',
  'notFound',
]

const TEMPLATES: Record<HttpResponseTemplateId, HttpResponseTemplate> = {
  // 详细错误：metadata.errorMsg（可能含内部地址，仅调试用）
  errorDetail: {
    id: 'errorDetail',
    statusCode: 502,
    body: () =>
      '{\n  "success": false,\n  "error": "${metadata.errorMsg}"\n}',
  },
  // 仅节点名：对外安全。占位符勿放进 i18n（会被当成插值吃掉）
  errorNode: {
    id: 'errorNode',
    statusCode: 502,
    body: (t) =>
      '{\n  "success": false,\n  "error": "${metadata.errorNode}' +
      t('forms.httpResponse.templateErrorNodeSuffix') +
      '"\n}',
  },
  // 留空 body = 引擎直接返回上游消息
  returnMsg: {
    id: 'returnMsg',
    statusCode: 200,
    body: () => '',
  },
  successWrap: {
    id: 'successWrap',
    statusCode: 200,
    body: () =>
      '{\n  "success": true,\n  "data": ${msg}\n}',
  },
  emptyOk: {
    id: 'emptyOk',
    statusCode: 200,
    body: () => '{\n  "success": true\n}',
  },
  unauthorized: {
    id: 'unauthorized',
    statusCode: 401,
    body: () =>
      '{\n  "success": false,\n  "error": "unauthorized"\n}',
  },
  notFound: {
    id: 'notFound',
    statusCode: 404,
    body: () =>
      '{\n  "success": false,\n  "error": "not found"\n}',
  },
}

/** 解析模板；未知 id 返回 null */
export function getHttpResponseTemplate(
  id: string,
): HttpResponseTemplate | null {
  if (!id || !(id in TEMPLATES)) return null
  return TEMPLATES[id as HttpResponseTemplateId]
}

/** 当前 body 是否视为「已有内容」（需确认覆盖） */
export function httpResponseBodyHasContent(body: unknown): boolean {
  return String(body ?? '').trim() !== ''
}
