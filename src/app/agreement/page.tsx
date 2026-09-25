import AgreementContent from '@/components/AgreementContent';

const DEFAULT_AGREEMENT = `欢迎使用校园墙！

一、服务说明
本平台为校园信息交流社区，用户可在此发布失物招领、二手交易、表白墙、寻物启事、招聘兼职等内容。

二、账号注册
1. 用户需提供真实信息进行注册；
2. 用户应妥善保管账号密码，因泄露造成的损失由用户自行承担；
3. 用户不得将账号转借他人使用。

三、内容规范
1. 禁止发布违法、违规、色情、暴力、政治敏感等内容；
2. 禁止发布广告、诈骗、传销等信息；
3. 禁止人身攻击、辱骂他人；
4. 违反上述规定者，平台有权删除内容并封禁账号。

四、知识产权
用户在平台发布的内容，版权归用户所有，但授予平台免费使用、展示、传播的权利。

五、免责声明
1. 平台仅提供信息发布服务，不对内容真实性负责；
2. 用户之间因交易产生的纠纷，由用户自行解决；
3. 因不可抗力导致服务中断，平台不承担责任。

六、协议修改
平台有权根据需要修改本协议，修改后的协议自公布之日起生效。
`;

export default function AgreementPage() {
  return <AgreementContent type="agreement" title="用户协议" defaultContent={DEFAULT_AGREEMENT} />;
}
