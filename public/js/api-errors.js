import {t,translate} from './i18n.js';

const messages={
  "时间需包含有效的时区": "Enter a time with a valid time zone.",
  "联系电话格式不正确": "Enter a valid phone number.",
  "地区": "Region",
  "网站地址无效": "Invalid site address.",
  "该网站地址未获允许": "This site address is not allowed.",
  "请求来源无效，请刷新页面后重试": "Refresh the page and try again.",
  "操作过于频繁，请稍后重试": "Too many requests. Please try again shortly.",
  "请先登录": "Please sign in.",
  "需要管理员权限": "Administrator access is required.",
  "账号验证尝试过多，请稍后重试": "Too many account attempts. Please try again later.",
  "邮箱格式不正确": "Enter a valid email address.",
  "邮箱或密码不正确": "Incorrect email address or password.",
  "账号已变化，请重新登录": "Your account has changed. Please sign in again.",
  "账号已停用，请联系管理员": "This account is disabled. Contact an administrator.",
  "新密码不能与当前密码相同": "Choose a password different from your current one.",
  "当前密码不正确": "Incorrect current password.",
  "包含不支持修改的资料字段": "One or more profile fields cannot be changed.",
  "请选择有效的性别选项": "Select a valid gender option.",
  "建议内容": "Suggestion",
  "建议内容包含无效字符": "The suggestion contains invalid characters.",
  "门店已回复这条建议，不能删除": "You can’t delete a suggestion the bookstore has replied to.",
  "建议不存在或已被删除": "This suggestion was not found or has been deleted.",
  "活动不存在或尚未发布": "This event was not found or has not been published.",
  "请同意将报名资料用于本次活动联系": "Agree to the use of your registration details for event communications.",
  "缺少活动编号": "An event is required.",
  "报名已截止": "Registration has closed.",
  "你已报名该活动": "You’re already registered for this event.",
  "活动名额已满": "This event is full.",
  "报名不存在": "Registration not found.",
  "该报名当前无法取消": "This registration can no longer be cancelled.",
  "书目不存在": "Book not found.",
  "反馈内容": "Feedback",
  "请选择报名记录": "Select a registration.",
  "仅可评价本人的有效报名": "You can only leave feedback for your own valid registrations.",
  "已取消的报名不能填写反馈": "You can’t leave feedback for a cancelled registration.",
  "签到后即可填写反馈；未签到的有效报名需等活动结束": "You can leave feedback after checking in or once the event ends.",
  "门店已回复这条反馈，不能删除": "You can’t delete feedback the bookstore has replied to.",
  "反馈不存在或已被删除": "This feedback was not found or has been deleted.",
  "接口不存在": "This action is not available.",
  "该邮箱已被使用": "This email address is already in use.",
  "该报名已提交反馈": "You’ve already left feedback for this registration.",
  "记录已存在，请勿重复提交": "This record already exists. Please don’t submit it twice.",
  "记录正在更新，请刷新后重试": "This record is being updated. Refresh and try again.",
  "数据关联或约束不符合要求": "The details you entered don’t meet the requirements.",
  "请求格式不正确": "The request format is invalid.",
  "服务暂时不可用，请稍后重试": "The service is temporarily unavailable. Please try again shortly.",
  "管理员身份已变化，请重新登录": "Your administrator access has changed. Please sign in again.",
  "修改字段不受支持": "One or more fields cannot be changed.",
  "报名截止规则无效": "Choose a valid registration deadline.",
  "每页条数": "Items per page",
  "页码": "Page number",
  "优先级筛选无效": "Select a valid priority.",
  "用户不存在": "User not found.",
  "用户组需为 user 或 stuff": "Choose the Reader or Administrator role.",
  "不能停用或降级当前登录的管理员": "You cannot disable or change the role of the administrator currently signed in.",
  "至少需要保留一位启用的管理员": "Keep at least one active administrator.",
  "该邮箱已被其他账号使用": "This email address is already in use.",
  "报名状态无效": "Select a valid registration status.",
  "活动尚未开始，暂不能签到": "Check-in opens when the event starts.",
  "该用户已有另一条有效报名": "This user already has an active registration.",
  "活动名额已满，不能恢复报名": "This event is full. The registration cannot be restored.",
  "反馈状态无效": "Select a valid feedback status.",
  "反馈不存在": "Feedback not found.",
  "回复不能超过 2000 个字符": "Keep the reply to 2,000 characters or fewer.",
  "标记为已回复前请填写回复内容": "Write a reply before marking this as replied.",
  "建议状态无效": "Select a valid suggestion status.",
  "建议不存在": "Suggestion not found.",
  "请设置未来的开始时间，结束时间需晚于开始时间": "Choose a future start time and a later end time.",
  "容量": "Capacity",
  "费用": "Fee",
  "发布状态不正确": "Select a valid publication status.",
  "活动不存在": "Event not found.",
  "结束时间需晚于开始时间": "The end time must be after the start time.",
  "容量不能少于当前有效报名人数": "Capacity cannot be lower than the current number of registrations.",
  "活动状态无效": "Select a valid event status.",
  "暂时连接不上 AI 服务，请稍后重试；你仍可直接浏览活动并报名。": "Could not connect to the assistant. You can still browse events and register directly.",
  "AI 服务繁忙或额度不足，请稍后重试。": "The assistant is busy or has reached its limit. Please try again later.",
  "AI 服务暂不可用，请联系网站负责人检查接口配置和额度。": "The assistant is unavailable. Please contact the site administrator.",
  "AI 回复未完整返回，请重新尝试。": "The reply was incomplete. Please try again.",
  "对话编号无效，请刷新页面。": "Invalid conversation. Please refresh the page.",
  "聊天过于频繁，请稍等一分钟。": "Too many messages. Please wait a minute.",
  "请等待当前回复结束后再清空。": "Wait for the current reply before clearing the chat.",
  "AI 助手尚未配置，你可以继续直接浏览活动并报名。": "The assistant is unavailable. You can still browse events and register directly.",
  "请输入 1–1500 个字符的消息。": "Enter a message between 1 and 1,500 characters.",
  "今日 AI 使用额度已用完，仍可直接使用网站功能。": "The assistant has reached its daily limit. The rest of the site is still available.",
  "助手正在接待其他读者，请稍后再试。": "The assistant is helping other readers. Please try again shortly.",
  "请等待上一条回复结束。": "Wait for the previous reply to finish.",
  "这次查询步骤较多，请缩小问题范围后重试。": "Try narrowing your question.",
  "AI 操作格式不完整，请重试。": "The assistant couldn’t complete the action. Please try again.",
  "助手暂未生成完整答复，请重试。": "The assistant didn’t finish its reply. Please try again.",
  "助手回复超时，请稍后重试。网站的直接报名功能仍可使用。": "The assistant took too long to respond. You can still register directly on the site.",
  "助手暂时无法完成查询，请稍后重试。": "The assistant couldn’t complete the request. Please try again.",
  "请求失败": "Request failed. Please try again.",
  "密码长度需为 {min}–{max} 个字符": "Use {min}–{max} characters for your password.",
  "{field}需填写 {min}–{max} 个字符": "{field} must be {min}–{max} characters long.",
  "{field}超出允许范围": "{field} is outside the allowed range.",
  "{field}包含无效字符": "{field} contains invalid characters."
};

export function errorMessage(message) {
  if(typeof message!=='string'||!message)return translate('请求失败',messages);
  const password=message.match(/^密码长度需为 (\d+)–(\d+) 个字符$/);
  if(password)return translate('密码长度需为 {min}–{max} 个字符',messages,{min:password[1],max:password[2]});
  const length=message.match(/^(.+)需填写 (\d+)–(\d+) 个字符$/);
  if(length)return translate('{field}需填写 {min}–{max} 个字符',messages,{field:fieldName(length[1]),min:length[2],max:length[3]});
  for(const suffix of ['超出允许范围','包含无效字符']){
    if(message.endsWith(suffix)&&message.length>suffix.length){
      const field=fieldName(message.slice(0,-suffix.length));
      return translate('{field}'+suffix,messages,{field});
    }
  }
  return translate(message,messages);
}

function fieldName(source){
  return Object.hasOwn(messages,source)?translate(source,messages):t(source);
}
