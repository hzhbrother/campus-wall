import AgreementContent from '@/components/AgreementContent';

const DEFAULT_PRIVACY = `校园墙非常重视用户隐私保护。

一、信息收集
1. 注册信息：账号名、密码（加密存储）、邮箱；
2. 个人资料：昵称、头像、真实姓名、年级、班级（可选）；
3. 内容数据：用户发布的帖子、评论、点赞等。

二、信息使用
1. 用于提供平台服务；
2. 用于身份验证和安全保护；
3. 用于改善服务质量。

三、信息保护
1. 密码采用 bcrypt 加密存储；
2. 我们不会将您的个人信息出售给第三方；
3. 采取合理的技术手段保护数据安全。

四、信息共享
1. 经用户同意后共享；
2. 法律法规要求时共享；
3. 与合作伙伴共享必要信息以提供服务。

五、Cookie 使用
本平台使用 Cookie 保持登录状态，您可在浏览器设置中清除。

六、用户权利
1. 访问、更正个人信息；
2. 删除账号及相关数据；
3. 撤回授权同意。

七、未成年人保护
未成年人使用本平台需在监护人指导下进行。

八、政策更新
本政策可能随时更新，重大变更将通过站内通知告知用户。
`;

export default function PrivacyPage() {
  return <AgreementContent type="privacy" title="隐私政策" defaultContent={DEFAULT_PRIVACY} />;
}
