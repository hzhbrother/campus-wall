// 支付提供商抽象层 + 各渠道实现 (从 NestJS 移植, 适配 Vercel 同源)
// 由 PAYMENT_PROVIDER 环境变量决定使用哪个渠道, 默认 mock

export interface PaymentContext {
  origin: string; // 部署的 URL, 用于构造支付页跳转与回调
}

export interface PaymentProvider {
  name: string;
  createPayment(
    order: { id: string; subject: string; amount: number },
    ctx: PaymentContext
  ): Promise<{ method: 'redirect' | 'qrcode' | 'mock'; payUrl?: string; qrCode?: string; raw?: any }>;
  parseNotify(rawBody: any, headers: any): { outTradeNo: string; verified: boolean; raw?: any };
}

// ---- Mock 支付 (无需凭据, 适合本地与演示) ----
export const mockProvider: PaymentProvider = {
  name: 'mock',
  async createPayment(order, ctx) {
    return { method: 'mock', payUrl: `${ctx.origin}/payment/mock?orderId=${order.id}` };
  },
  parseNotify() {
    return { outTradeNo: '', verified: false };
  },
};

// ---- 支付宝接入点 (需 npm i alipay-sdk 后实现) ----
export const alipayProvider: PaymentProvider = {
  name: 'alipay',
  async createPayment(order) {
    if (!process.env.ALIPAY_APP_ID || !process.env.ALIPAY_PRIVATE_KEY) {
      throw new Error('支付宝未配置凭据, 请在 Vercel 环境变量填 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY');
    }
    // TODO: 接入 alipay-sdk 调用 alipay.trade.page.pay, 返回跳转 URL
    return { method: 'redirect', payUrl: '#' };
  },
  parseNotify(body: any) {
    return { outTradeNo: body?.out_trade_no || '', verified: false, raw: body };
  },
};

// ---- 微信支付 V3 接入点 (需 npm i wechatpay-node-v3 后实现) ----
export const wechatPayProvider: PaymentProvider = {
  name: 'wechatpay',
  async createPayment(order) {
    if (!process.env.WECHATPAY_MCH_ID || !process.env.WECHATPAY_API_V3_KEY) {
      throw new Error('微信支付未配置凭据, 请在 Vercel 环境变量填 WECHATPAY_MCH_ID / WECHATPAY_API_V3_KEY');
    }
    // TODO: 接入微信支付 V3 Native 下单, 返回 code_url 生成二维码
    return { method: 'qrcode', qrCode: 'todo-generate-from-code_url' };
  },
  parseNotify(body: any) {
    return { outTradeNo: body?.out_trade_no || '', verified: false, raw: body };
  },
};

export function getProvider(): PaymentProvider {
  const name = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  if (name === 'alipay') return alipayProvider;
  if (name === 'wechatpay') return wechatPayProvider;
  return mockProvider;
}
