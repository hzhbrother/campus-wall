// 国家/地区区号与手机号位数规则
// 仅做位数校验, 不校验号码真实性, 不发短信验证码

export interface CountryCode {
  code: string;        // 区号, 如 "+86"
  name: string;        // 国家/地区名称
  shortName: string;   // 简称
  lengths: number[];   // 允许的手机号位数 (不含区号)
}

// 常用国家/地区列表 (前端按此顺序展示)
export const COUNTRY_CODES: CountryCode[] = [
  { code: '+86',  name: '中国大陆', shortName: '中国', lengths: [11] },
  { code: '+852', name: '中国香港', shortName: '香港', lengths: [8] },
  { code: '+853', name: '中国澳门', shortName: '澳门', lengths: [8] },
  { code: '+886', name: '中国台湾', shortName: '台湾', lengths: [9, 10] },
  { code: '+1',   name: '美国/加拿大', shortName: '美国', lengths: [10] },
  { code: '+44',  name: '英国', shortName: '英国', lengths: [10, 11] },
  { code: '+81',  name: '日本', shortName: '日本', lengths: [10, 11] },
  { code: '+82',  name: '韩国', shortName: '韩国', lengths: [9, 10, 11] },
  { code: '+65',  name: '新加坡', shortName: '新加坡', lengths: [8] },
  { code: '+60',  name: '马来西亚', shortName: '马来西亚', lengths: [9, 10] },
  { code: '+66',  name: '泰国', shortName: '泰国', lengths: [9] },
  { code: '+84',  name: '越南', shortName: '越南', lengths: [9, 10] },
  { code: '+63',  name: '菲律宾', shortName: '菲律宾', lengths: [10] },
  { code: '+62',  name: '印度尼西亚', shortName: '印尼', lengths: [10, 11, 12] },
  { code: '+91',  name: '印度', shortName: '印度', lengths: [10] },
  { code: '+61',  name: '澳大利亚', shortName: '澳大利亚', lengths: [9] },
  { code: '+64',  name: '新西兰', shortName: '新西兰', lengths: [9, 10] },
  { code: '+49',  name: '德国', shortName: '德国', lengths: [10, 11] },
  { code: '+33',  name: '法国', shortName: '法国', lengths: [9] },
  { code: '+39',  name: '意大利', shortName: '意大利', lengths: [9, 10] },
  { code: '+34',  name: '西班牙', shortName: '西班牙', lengths: [9] },
  { code: '+7',   name: '俄罗斯', shortName: '俄罗斯', lengths: [10] },
  { code: '+55',  name: '巴西', shortName: '巴西', lengths: [10, 11] },
  { code: '+52',  name: '墨西哥', shortName: '墨西哥', lengths: [10] },
];

const CODE_MAP: Record<string, CountryCode> = COUNTRY_CODES.reduce(
  (acc, c) => { acc[c.code] = c; return acc; },
  {} as Record<string, CountryCode>
);

export function getCountryByCode(code: string | null | undefined): CountryCode {
  if (code && CODE_MAP[code]) return CODE_MAP[code];
  return COUNTRY_CODES[0]; // 默认中国大陆
}

// 校验手机号位数 (不校验真实性, 不发短信)
export function validatePhone(countryCode: string, phoneNumber: string): { ok: boolean; message?: string } {
  const country = getCountryByCode(countryCode);
  if (!phoneNumber || !phoneNumber.trim()) {
    return { ok: false, message: '请输入手机号' };
  }
  // 仅允许数字
  if (!/^\d+$/.test(phoneNumber)) {
    return { ok: false, message: '手机号只能包含数字' };
  }
  if (!country.lengths.includes(phoneNumber.length)) {
    const expected = country.lengths.join('/');
    return { ok: false, message: `${country.shortName}手机号应为 ${expected} 位` };
  }
  return { ok: true };
}
