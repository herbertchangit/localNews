import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
const zh: Record<string, string> = {
  BREAKING: "突发",
  "Riverside renewal plan approved after landmark council vote":
    "市议会通过河滨更新计划",
  "LOCAL NEWS": "本地新闻",
  "THE CITY, CLEARLY": "清晰看见城市",
  Local: "本地",
  Politics: "政治",
  Business: "商业",
  Sports: "体育",
  Culture: "文化",
  Newsroom: "新闻中心",
  Login: "登入",
  Logout: "登出",
  "Developing story": "持续报道",
  "Read full story": "阅读完整报道",
  "Live from the heart of our community": "来自社区中心的现场报道",
  "THE DAILY BRIEF": "每日简报",
  "What your city is talking about": "全城热议",
  "View newsroom": "查看新闻中心",
  "STAY INFORMED": "掌握资讯",
  "Join us with your HearT": "與我們用心同行",
  "Create your DaDe reader account and follow every published story.":
    "建立您的大德讀者帳號，閱讀每一篇已發布新聞。",
  "Stay area": "居住地區",
  "City or area": "城市或地區",
  "At least 8 characters": "至少 8 個字元",
  "Sign Up": "註冊",
  "Signing up…": "註冊中…",
  "Every new account is registered as DaDe.": "所有新帳號均註冊為大德。",
  "A concise local briefing, delivered every weekday morning.":
    "每个工作日早晨，为你送上精简本地简报。",
  "Join the briefing": "订阅简报",
  "Reporting with context, accountability and care.":
    "以脉络、责任与关怀进行报道。",
  "INDEPENDENT. ESSENTIAL.": "独立 · 必要",
  "NEWSROOM OS": "新闻中心系统",
  WORKSPACE: "工作空间",
  "Central News Desk": "中央新闻台",
  Overview: "总览",
  Stories: "新闻稿",
  People: "人员",
  Departments: "部门",
  Analytics: "数据分析",
  Settings: "设置",
  Administrator: "管理员",
  "Good evening, Harper.": "晚上好，Harper。",
  "Here’s what’s happening across your newsroom.": "这是新闻中心的最新动态。",
  "New story": "新建新闻",
  Published: "已发布",
  "In review": "审核中",
  "Monthly readers": "每月读者",
  Engagement: "互动率",
  "Needs attention": "需要处理",
  "Editorial queue": "编辑队列",
  "Stories requiring your attention": "需要你处理的新闻稿",
  "View all": "查看全部",
  "Audience pulse": "读者趋势",
  "Readers over the last 7 days": "过去 7 天读者数",
  "Live desk": "实时新闻台",
  "Recent newsroom activity": "最近新闻中心动态",
  Approve: "批准",
  "Request revision": "要求修改",
  Active: "启用",
  Locked: "已锁定",
  Suspended: "已停用",
  "INDEPENDENT JOURNALISM": "独立新闻",
  "The city’s story starts here.": "城市故事，从这里开始。",
  "A secure workspace for editors, reporters and newsroom leaders.":
    "为编辑、记者和新闻中心管理者打造的安全工作空间。",
  "LOCAL NEWS · CENTRAL DESK": "本地新闻 · 中央新闻台",
  "WELCOME BACK": "欢迎回来",
  "Sign in to the newsroom": "登录新闻中心",
  "Use your assigned Local News account.": "使用分配给你的本地新闻账号。",
  "Email address": "电子邮箱",
  Password: "密码",
  "Keep me signed in": "保持登录",
  "Forgot password?": "忘记密码？",
  "Sign in": "登入",
  "Signing in…": "正在登录…",
  Editor: "编辑",
  Reporter: "记者",
  "Return to Local News": "返回本地新闻",
  "Show password": "显示密码",
  "Hide password": "隐藏密码",
  "Sign out": "退出登录",
  "ADMINISTRATION / PEOPLE": "管理 / 人员",
  "User management": "用户管理",
  "Control access, assignments and newsroom permissions.":
    "管理访问权限、工作分配和新闻中心权限。",
  "Create user": "创建用户",
  "Total people": "总人数",
  Editors: "编辑人数",
  "Newsroom departments": "新闻部门",
  "Inactive accounts": "停用账号",
  "People directory": "人员目录",
  "Activity logs": "活动日志",
  "Search people, email or department": "搜索姓名、邮箱或部门",
  "All roles": "所有角色",
  All: "全部",
  "News categories": "新聞類別",
  "Finding the latest published reporting.": "正在尋找最新發布的新聞。",
  "Choose another news category or return to all published stories.": "請選擇其他新聞類別，或返回全部已發布新聞。",
  "Show all stories": "顯示全部新聞",
  Person: "人员",
  Assignment: "分配",
  Role: "角色",
  Status: "状态",
  Actions: "操作",
  Unassigned: "未分配",
  "No categories": "未分配类别",
  "No staff assigned": "未分配人员",
  "Edit user": "编辑用户",
  "Reset password": "重设密码",
  Lock: "锁定",
  Unlock: "解锁",
  Suspend: "停用",
  Restore: "恢复",
  Delete: "删除",
  "Loading people…": "正在加载人员…",
  "Administrator activity": "管理员活动",
  "Latest security and account-management events": "最新安全与账号管理记录",
  Refresh: "刷新",
  "No activity recorded yet.": "暂无活动记录。",
  "NEW ACCOUNT": "新账号",
  "EDIT ACCOUNT": "编辑账号",
  "Create newsroom user": "创建新闻中心用户",
  "Full name": "姓名",
  Email: "邮箱",
  "Temporary password": "临时密码",
  Department: "部门",
  "Assigned news categories": "分配新闻类别",
  Permissions: "权限",
  "Create stories": "创建新闻",
  "Edit all stories": "编辑所有新闻",
  "Publish stories": "发布新闻",
  "Manage users": "管理用户",
  "Moderate comments": "审核评论",
  "View analytics": "查看数据分析",
  "Lock account": "锁定账号",
  "Suspend user": "停用用户",
  Cancel: "取消",
  "Save changes": "保存更改",
  SECURITY: "安全",
  "Set a new temporary password for": "设置新的临时密码：",
  "New password": "新密码",
  "Reset password successfully": "密码重设成功",
  "ADMINISTRATION / ORGANIZATION": "管理 / 组织",
  "Department management": "部门管理",
  "Organize newsroom teams and their staff assignments.":
    "管理新闻团队及人员分配。",
  "Create department": "创建部门",
  "Assigned people": "已分配人员",
  "Active departments": "启用部门",
  "Search departments": "搜索部门",
  Members: "成员",
  Created: "创建日期",
  "Active newsroom desk": "启用中的新闻部门",
  "Edit department": "编辑部门",
  "View assigned users": "查看已分配用户",
  "Delete department": "删除部门",
  "Loading departments…": "正在加载部门…",
  "No departments match your search.": "没有符合搜索条件的部门。",
  "NEW DEPARTMENT": "新部门",
  "EDIT DEPARTMENT": "编辑部门",
  "Rename department": "重命名部门",
  "Department name": "部门名称",
  "Departments can be assigned to users from the People management page.":
    "可在人员管理页面为用户分配部门。",
  "Create users": "创建用户",
  "Edit users": "编辑用户",
  "Delete users": "删除用户",
  "Reset passwords": "重设密码",
  "Lock accounts": "锁定账号",
  "Assign roles": "分配角色",
  "Assign departments": "分配部门",
  "Assign news categories": "分配新闻类别",
  "Assign permissions": "分配权限",
  "Suspend users": "停用用户",
  "View activity logs": "查看活动日志",
  "Search by name or email": "按姓名或邮箱搜索",
  "Search users": "搜索用户",
  "Add user": "添加用户",
  "NEW TEAM MEMBER": "新团队成员",
  "Add a newsroom user": "添加新闻中心用户",
  "The user can sign in immediately with this temporary password.":
    "用户可立即使用此临时密码登录。",
  "All rights reserved.": "版权所有。",
  "READER DESK": "读者中心",
  "MY ACCOUNT": "我的账号",
  "Audience Portal": "读者门户",
  Audience: "读者",
  "AUDIENCE / STORIES": "读者 / 新闻",
  "Your local stories": "你的本地新闻",
  "Published reporting from across the community.":
    "来自社区各处的已发布报道。",
  "Public homepage": "公共主页",
  "YOUR DAILY READING": "每日阅读",
  "Stay close to the stories shaping your city.": "紧贴塑造城市的每个故事。",
  "Verified reporting, local context, and community voices—all in one place.":
    "经核实的报道、本地脉络和社区声音，尽在一处。",
  "Published stories": "已发布新闻",
  "Loading stories…": "正在加载新闻…",
  "AUDIENCE / SETTINGS": "读者 / 设置",
  "Account settings": "账号设置",
  "View and manage your Local News account.": "查看并管理你的本地新闻账号。",
  "Loading account…": "正在加载账号…",
  "Profile details": "个人资料",
  "Update your personal information.": "更新个人信息。",
  "Save profile": "保存资料",
  "Change password": "更改密码",
  "Keep your account protected.": "保护账号安全。",
  "Current password": "当前密码",
  "Update password": "更新密码",
  "Account role": "账号角色",
  "Member since": "注册日期",
  "Last updated": "最后更新",
  "Delete account": "删除账号",
  "Permanently remove your profile and reading account.":
    "永久删除你的个人资料和读者账号。",
  "Delete my account": "删除我的账号",
  "Profile updated successfully": "个人资料更新成功",
  "Password changed successfully": "密码更改成功",
};
Object.assign(zh, {
  "Organization Chart": "组织架构",
  "Open Organization Chart Maintenance": "打开组织架构维护",
  "News Categories": "新聞類別",
  "Open News Category Management": "開啟新聞類別管理",
  "SETTINGS / ORGANIZATION CHART": "设置 / 组织架构",
  "Organization chart maintenance": "组织架构维护",
  "Maintain the Harmony, MutualLove and Cooperation hierarchy.":
    "维护 Harmony、MutualLove 与 Cooperation 层级。",
  "Add row": "新增一行",
  "Harmony groups": "Harmony 组别",
  "MutualLove groups": "MutualLove 组别",
  "Cooperation entries": "Cooperation 项目",
  "Search organization chart": "搜索组织架构",
  "Loading organization chart…": "正在加载组织架构…",
  "No organization chart rows match your search.":
    "没有符合搜索条件的组织架构记录。",
  "Edit organization chart row": "编辑组织架构记录",
  "Delete organization chart row": "删除组织架构记录",
  "EDIT HIERARCHY ROW": "编辑层级记录",
  "NEW HIERARCHY ROW": "新层级记录",
  "Edit organization chart": "编辑组织架构",
  "Add organization chart row": "新增组织架构记录",
  "Sort order": "排序",
  "Organization chart row updated": "组织架构记录已更新",
  "Organization chart row created": "组织架构记录已创建",
  "Organization chart row deleted": "组织架构记录已删除",
});
Object.assign(zh, {
  "SETTINGS / NORMALIZED ORGANIZATION": "设置 / 规范化组织",
  "Organization hierarchy": "组织层级",
  "Normalized Harmony, MutualLove and Cooperation master data.":
    "规范化的 Harmony、MutualLove 与 Cooperation 主数据。",
  "Cooperation units": "Cooperation 单位",
  "Hierarchy table": "层级表",
  "Loading hierarchy…": "正在加载层级…",
  "Linked groups": "关联组别",
  "NORMALIZED MASTER DATA": "规范化主数据",
  "Create Harmony": "创建 Harmony",
  "Create MutualLove": "创建 MutualLove",
  "Create Cooperation": "创建 Cooperation",
  "Edit Harmony": "编辑 Harmony",
  "Edit MutualLove": "编辑 MutualLove",
  "Edit Cooperation": "编辑 Cooperation",
  "Harmony group": "Harmony 组别",
  "MutualLove group": "MutualLove 组别",
  "Organization hierarchy saved": "组织层级已保存",
  "Organization hierarchy item deleted": "组织层级项目已删除",
});
Object.assign(zh, {
  Harmony: "和氣",
  "Harmony group": "和氣組別",
  "Harmony groups": "和氣組別",
  "Create Harmony": "建立和氣",
  "Edit Harmony": "編輯和氣",
  MutualLove: "互愛",
  "MutualLove group": "互愛組別",
  "MutualLove groups": "互愛組別",
  "Create MutualLove": "建立互愛",
  "Edit MutualLove": "編輯互愛",
  Cooperation: "協力",
  "Cooperation unit": "協力單位",
  "Cooperation units": "協力單位",
  "Cooperation entries": "協力項目",
  "Create Cooperation": "建立協力",
  "Edit Cooperation": "編輯協力",
  Member: "會員大德",
  Members: "會員大德",
  Volunteer: "志工",
  Volunteers: "志工",
  "Normalized Harmony, MutualLove and Cooperation master data.":
    "規範化的和氣、互愛與協力主資料。",
  "Maintain the Harmony, MutualLove and Cooperation hierarchy.":
    "維護和氣、互愛與協力層級。",
});
Object.assign(zh, {
  "Manage your profile and organization assignment.":
    "管理你的個人資料與組織分配。",
  "Profile and organization": "個人資料與組織",
  "Update your account and hierarchy assignment.": "更新你的帳號與層級分配。",
  "Organization hierarchy": "組織層級",
  "Profile and organization assignment updated": "個人資料與組織分配已更新",
});
Object.assign(zh, {
  Organization: "志業/角色",
  Organizations: "志業/角色",
  "Organization management": "志業/角色管理",
  "Organization assignment": "志業/角色分配",
  "Newsroom organizations": "新聞中心志業/角色",
  "Active organizations": "啟用中的志業/角色",
  "Search organizations": "搜尋志業/角色",
  "Create organization": "建立志業/角色",
  "Edit organization": "編輯志業/角色",
  "Delete organization": "刪除志業/角色",
  "Open Organization Management": "開啟志業/角色管理",
});
Object.assign(zh, {
  Admin: "管理員",
  Volunteer: "志工",
  DaDe: "會員大德",
  VOLUNTEER: "志工",
  DADE: "會員大德",
});
Object.assign(zh, {
  "Profile photo": "個人照片",
  "Upload a photo for your account.": "為你的帳號上傳照片。",
  "Upload photo": "上傳照片",
  "Change photo": "更換照片",
  "Remove photo": "移除照片",
  Remove: "移除",
  "Uploading…": "上傳中…",
  "PNG, JPEG or WebP · maximum 2 MB": "PNG、JPEG 或 WebP · 最大 2 MB",
  "Profile photo updated": "個人照片已更新",
  "Profile photo removed": "個人照片已移除",
});
Object.assign(zh, {
  "User photo": "使用者照片",
  "User photo updated": "使用者照片已更新",
  "User photo removed": "使用者照片已移除",
  "Organization assignment": "志業/角色分配",
});
Object.assign(zh, {
  "NEW STORY": "新新聞",
  "Create story draft": "建立新聞草稿",
  "Start a draft for editorial review. It will not be published automatically.": "建立草稿供編輯審核，不會自動發布。",
  "Story title": "新聞標題",
  "News category": "新聞類別",
  "Select category": "選擇類別",
  "Summary": "摘要",
  "Story content": "新聞內容",
  "Save draft": "儲存草稿",
  "Saving…": "儲存中…",
  Saved: "已儲存",
  "Your profile changes are being saved.": "正在儲存你的個人資料變更。",
  "Your profile is up to date.": "你的個人資料已更新。",
  "New story": "新增新聞",
  "Draft saved:": "草稿已儲存：",
});
Object.assign(zh, {
  "Read Story": "閱讀新聞",
  "Independent reporting for our community": "為社區提供獨立報導",
  "Back to local news": "返回本地新聞",
  "Loading full story…": "正在載入完整新聞…",
  "Story not found": "找不到新聞",
  "STORY GALLERY": "新聞相簿",
  "More from this story": "更多新聞照片",
  "Story photos and captions": "新聞照片及說明",
  "Add photos": "新增照片",
  "Caption": "圖片說明",
  "Describe this photo": "說明這張照片",
  "No photos yet": "尚未有照片",
  "Remove": "移除",
  "Edit": "編輯",
  "HEADLINE": "頭條",
  "Headline": "頭條",
  "Set as headline": "設為頭條",
  "Remove headline": "移除頭條",
  "published stories": "篇已發布新聞",
  "Scroll Daily Brief left": "向左捲動每日簡報",
  "Scroll Daily Brief right": "向右捲動每日簡報",
  "Unpublish": "取消發布",
});
Object.assign(zh, {
  "READER VOICES": "讀者心聲",
  "Responses and comments": "回應與留言",
  "Share how this story speaks to you and join the conversation.": "分享這篇新聞帶給你的感受，並加入交流。",
  "Your response": "你的回應",
  Understanding: "善解",
  Tolerance: "包容",
  Gratitude: "感恩",
  Contentment: "知足",
  "Choose one response. You can change it at any time.": "請選擇一項回應，你可隨時更改。",
  "Sign in to respond or comment": "登入以回應或留言",
  "Share a comment": "分享留言",
  "Write your comment…": "寫下你的留言……",
  "Post comment": "發布留言",
  "Posting…": "發布中……",
  "Response saved": "回應已儲存",
  "Photo responses": "照片回應",
  "Photo response saved": "照片回應已儲存",
  "Comment posted": "留言已發布",
  Comments: "留言",
  "Loading comments…": "正在載入留言……",
  "No comments yet. Start the conversation.": "尚無留言，歡迎開始交流。",
});
const missionZh: Record<string, string> = {
  "Charity Mission": "慈善志業",
  "Medical Mission": "醫療志業",
  "Education Mission": "教育志業",
  "Humanistic Mission": "人文志業",
};
const missionEn: Record<string, string> = Object.fromEntries(
  Object.entries(missionZh).map(([english, chinese]) => [chinese, english]),
);
Object.assign(zh, missionZh);
const originals = new WeakMap<Node, string>();
const sidebarLabels = new WeakMap<Node, { en: string; zh: string }>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
function translate(root: ParentNode, lang: "en" | "zh") {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const raw = n.nodeValue || "",
      key = raw.trim(),
      sidebarParts = n.parentElement?.closest("aside") ? key.split(" / ") : [],
      parsedSidebarLabel =
        sidebarParts.length === 2 && /[\u3400-\u9fff]/.test(sidebarParts[1])
          ? { en: sidebarParts[0], zh: sidebarParts[1] }
          : undefined,
      sidebarLabel = sidebarLabels.get(n) || parsedSidebarLabel,
      mission = lang === "zh" ? missionZh[key] : missionEn[key],
      dynamic = key.startsWith("Organization: ")
        ? `志業/角色：${key.slice(14)}`
        : key.startsWith("No published stories in ")
          ? `「${key.slice(24, -1)}」沒有已發布新聞。`
          : "";
    if (sidebarLabel) {
      if (parsedSidebarLabel && !sidebarLabels.has(n)) {
        sidebarLabels.set(n, parsedSidebarLabel);
        originals.set(n, raw.replace(key, parsedSidebarLabel.en));
      }
      n.nodeValue = raw.replace(key, sidebarLabel[lang]);
    } else if (mission) {
      n.nodeValue = raw.replace(key, mission);
    } else if (lang === "zh" && (zh[key] || dynamic)) {
      if (!originals.has(n)) originals.set(n, raw);
      n.nodeValue = raw.replace(key, zh[key] || dynamic);
    } else if (lang === "en" && originals.has(n)) {
      n.nodeValue = originals.get(n)!;
      originals.delete(n);
    }
  }
  const elements =
    root instanceof Element
      ? [root, ...root.querySelectorAll("*")]
      : [...root.querySelectorAll("*")];
  for (const el of elements) {
    for (const attr of ["placeholder", "aria-label", "title"]) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      if (lang === "zh" && zh[value]) {
        let map = attrOriginals.get(el);
        if (!map) {
          map = new Map();
          attrOriginals.set(el, map);
        }
        if (!map.has(attr)) map.set(attr, value);
        el.setAttribute(attr, zh[value]);
      } else if (lang === "en") {
        const map = attrOriginals.get(el);
        if (map?.has(attr)) {
          el.setAttribute(attr, map.get(attr)!);
          map.delete(attr);
        }
      }
    }
  }
}
export default function I18n() {
  const [lang, setLang] = useState<"en" | "zh">(
    () => (localStorage.getItem("ln_lang") as any) || "en",
  );
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    translate(document.body, lang);
    const observer = new MutationObserver((records) =>
      records.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (n.nodeType === 1) translate(n as Element, lang);
          else if (n.nodeType === 3 && n.parentNode)
            translate(n.parentNode, lang);
        }),
      ),
    );
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [lang]);
  const change = (next: "en" | "zh") => {
    localStorage.setItem("ln_lang", next);
    setLang(next);
  };
  return (
    <div className="languageSwitch" role="group" aria-label="Language">
      <Languages />
      <button
        className={lang === "en" ? "active" : ""}
        onClick={() => change("en")}
      >
        EN
      </button>
      <span>/</span>
      <button
        className={lang === "zh" ? "active" : ""}
        onClick={() => change("zh")}
      >
        中文
      </button>
    </div>
  );
}
