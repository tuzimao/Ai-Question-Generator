function safeJson<T = any>(val: any): T | undefined {
  if (val == null) return undefined;
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s === 'null') return undefined;
    try { return JSON.parse(s); } catch { return undefined; }
  }
  if (Buffer.isBuffer(val)) {
    try { return JSON.parse(val.toString('utf8')); } catch { return undefined; }
  }
  if (typeof val === 'object') {
    // 已经是对象就直接返回
    return val as T;
  }
  return undefined;
}