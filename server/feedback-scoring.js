// 反馈与建议的智能打分引擎（可解释规则基线，不依赖外部模型，可在 Node 与浏览器复用）。
// 词条库沿用《作业/softr复现/keyword_rules.csv》51 条基准权重（安全与合规、资金与会员权益、
// 商品与餐饮质量、服务态度与失误、线上系统故障、环境与设施、强情绪表达、改善建议、正向肯定），
// 并按本店阅读活动场景扩展三组：阅读活动与内容、服务与体验建议、无意义与噪声。
// 打分语义与 Softr 公式字段一致：
//   总分 = 命中词条权重累加（负向问题词加分、表扬词减分）
//        + 星级补偿（活动反馈 1 星 +12、2 星 +6）
//        + SLA 等待加成（待处理超 24 小时 +4、超 48 小时 +8，仅在管理端排序/筛选时按当前时间动态计算）
//   优先级：命中「安全与合规」词条直接判高；否则总分 ≥60 高、≥30 中、<30 低。
// 参考标准：客服工单 P0/P1/P2 分级（安全与资金类问题首响最快、aging 工单升级、
// 功能建议类进入低优先级批次处理）与 VOC 关键词加权打分实践。
export const SCORE_LEVELS=['high','mid','low'];
const SAFETY_GROUP='安全与合规';
const KEYWORD_RULES=[];
const add=(group,entries)=>{for(const [term,weight] of entries)KEYWORD_RULES.push({group,term,weight});};
// 安全与合规：命中即最高优先级（人身与食品安全，无阈值谈判空间）。
add('安全与合规',[['异物',50],['食品安全',50],['滑倒',45],['摔倒',45],['很滑',45],['过期',45],['漏电',45],['消防',40]]);
// 资金与会员权益：直接资金损失，次高优先级。
add('资金与会员权益',[['多扣',35],['乱收钱',34],['余额不对',32],['退款',28],['优惠券不能用',28],['对不上',22],['价格偏高',20]]);
// 商品与餐饮质量。
add('商品与餐饮质量',[['不新鲜',22],['难吃',20],['很差',16]]);
// 服务态度与失误。
add('服务态度与失误',[['态度恶劣',26],['态度差',24],['敷衍',20],['没人',16],['等了',16]]);
// 线上系统故障。
add('线上系统故障',[['支付失败',22],['闪退',20],['报错',18],['打不开',18],['卡顿',14]]);
// 环境与设施。
add('环境与设施',[['漏水',20],['异味',16],['排队',14],['空调',12],['噪音',12],['插座',12],['洗手间',12],['太暗',10],['桌面灯',8],['座位',8],['太少',8],['不够',8],['缺少',8]]);
// 强情绪表达：流失风险信号。
add('强情绪表达',[['再也不来',14],['失望',10]]);
// 改善建议：建设性信号，小幅加分。
add('改善建议',[['建议',8],['希望',6]]);
// 正向肯定：表扬无待办事项，负权重下沉。
add('正向肯定',[['贴心',-12],['感谢',-10],['专业',-10],['很好',-10],['推荐',-8],['不错',-8]]);
// 阅读活动与内容：本店核心业务的建设性活动建议，高价值（如亲子阅读活动）。
add('阅读活动与内容',[['阅读活动',32],['亲子',30],['孩子',26],['儿童',26],['读书会',20],['讲座',16],['分享会',16],['书目',14],['共读',12],['作者',12],['作家',12],['新书',12],['选书',10],['绝版',10],['夜读',10],['自然观察',10],['系列活动',8],['通识',8]]);
// 服务与体验建议：中等价值的经营改善建议。
add('服务与体验建议',[['会员',10],['营业时间',10],['储值',10],['延长',8],['预约',8],['选座',8],['咖啡',8],['饮品',8],['餐饮',8],['文创',8],['折扣',8],['快递',8],['直播',8],['社群',8],['志愿者',8],['讲解',8],['积分',8],['优惠',6],['甜点',6],['周边',6]]);
// 无意义与噪声：测试、敷衍与「XX 可以取消吗」式无信息量提问，负权重下沉。
add('无意义与噪声',[['测试',-12],['无所谓',-8],['随便',-6],['不知道',-6],['取消',-4],['哈哈',-4]]);
export function levelOf(score,forced=false){
 if(forced||score>=60)return 'high';
 if(score>=30)return 'mid';
 return 'low';
}
// 对一条反馈/建议内容打分。rating 仅活动反馈传入（1–5），建议传 null。
export function scoreContent(content,{rating=null}={}){
 const text=typeof content==='string'?content:'';
 let score=0;const hits=[];let forced=false;
 for(const rule of KEYWORD_RULES){
  if(text.includes(rule.term)){score+=rule.weight;hits.push(rule.term);if(rule.group===SAFETY_GROUP)forced=true;}
 }
 if(rating===1)score+=12;else if(rating===2)score+=6;
 return {score,level:levelOf(score,forced),hits,forced};
}
// SLA 等待加成：仅待处理工单随等待时长升级，与 Softr 公式字段「等待加成」一致。
export function waitBonus(status,createdAt,now=Date.now()){
 if(status!=='pending')return 0;
 const age=now-new Date(createdAt).getTime();
 if(!Number.isFinite(age)||age<0)return 0;
 if(age>=48*3600000)return 8;
 if(age>=24*3600000)return 4;
 return 0;
}
export function totalScore(score,status,createdAt,now){return score+waitBonus(status,createdAt,now);}
// 展示与筛选用的动态优先级：安全硬升级优先于分数阈值。
export function levelOfTotal(total,storedLevel){
 if(storedLevel==='high')return 'high';
 return levelOf(total);
}
