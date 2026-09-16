# GitHub 双账号 SSH 配置与切换

> 适用场景：同一台开发机上使用两个 GitHub 账号（例如「工作」+「个人」），且都通过 SSH 推送代码。

## 核心思路

SSH 协议本身只认「用了哪把密钥」，不认「这是哪个 GitHub 账号」。所以能让两个账号共存的关键是三步：

1. 每个账号配一把**独立的密钥**
2. 在 `~/.ssh/config` 里用 **Host 别名** 把「别名 → 密钥」绑定起来
3. 每个仓库的 **remote 地址使用对应的别名**

这样就不存在"切换"的动作了 —— 哪个仓库用哪个账号，在克隆时就已经确定，之后无需来回改配置。

---

## 一、为两个账号生成独立密钥

```bash
# 账号 A（例如工作账号）
ssh-keygen -t ed25519 -C "work@example.com" -f ~/.ssh/id_ed25519_work

# 账号 B（例如个人账号）
ssh-keygen -t ed25519 -C "personal@example.com" -f ~/.ssh/id_ed25519_personal
```

参数说明：

| 参数 | 作用 |
|------|------|
| `-t ed25519` | 密钥类型，比 RSA 更短更安全，GitHub 推荐 |
| `-C "邮箱"` | 备注信息，会显示在 GitHub 密钥列表里，方便辨认 |
| `-f 路径` | 指定输出文件名，**避免覆盖默认的 `id_ed25519`** |

中途会询问 passphrase，直接回车表示不设密码（方便，但密钥文件泄露风险更高）；也可以设置一个。

生成后会得到两个文件：`id_ed25519_work`（私钥，绝不外传）和 `id_ed25519_work.pub`（公钥，用于上传）。

---

## 二、把公钥添加到各自的 GitHub 账号

```bash
# macOS 下直接复制到剪贴板
cat ~/.ssh/id_ed25519_work.pub | pbcopy
cat ~/.ssh/id_ed25519_personal.pub | pbcopy
```

分别登录两个 GitHub 账号，进入 **Settings → SSH and GPG keys → New SSH key**，粘贴公钥。

> ⚠️ 一定要添加 `.pub` 结尾的**公钥**。私钥（没有 `.pub` 后缀的那个文件）泄露等于账号被接管。

---

## 三、配置 `~/.ssh/config`

编辑（没有就新建）`~/.ssh/config`：

```ssh-config
# ── 账号 A：工作（作为默认，直接用 github.com）──
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes

# ── 账号 B：个人（通过别名 github-personal 访问）──
Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes
```

两个关键点：

- **`IdentitiesOnly yes` 必须加**。否则 SSH 会先尝试 ssh-agent 里缓存的所有密钥，可能用错密钥导致 `Permission denied`。
- **别名只影响本地**。`github-personal` 是你自己起的名字，GitHub 那边完全不知道；它最终仍然连到 `github.com`（由 `HostName` 决定）。

顺手把权限收紧（SSH 会因权限过松拒绝加载）：

```bash
chmod 600 ~/.ssh/config
chmod 600 ~/.ssh/id_ed25519_*
```

---

## 四、让仓库使用对应的别名

**克隆新仓库时**，把 URL 里的 `github.com` 换成别名：

```bash
# 用个人账号克隆
git clone git@github-personal:用户名/仓库名.git

# 用工作账号克隆
git clone git@github.com:用户名/仓库名.git
```

**已有仓库**改 remote：

```bash
cd 已有仓库目录

# 查看当前 remote
git remote -v

# 改为个人账号的别名
git remote set-url origin git@github-personal:用户名/仓库名.git
```

---

## 五、配置提交身份（`user.name` / `user.email`）

这一步和 SSH 是**两回事**，但最容易被忽略：

- **SSH 决定「能不能推上去」**（权限）
- **`user.name` / `user.email` 决定「提交记录里显示谁」**（署名）

两者不一致会导致：代码推上去了，但 commit 作者是另一个账号。所以每个仓库要单独确认。

```bash
# 全局默认（建议设为常用账号，例如工作）
git config --global user.name "工作用名字"
git config --global user.email "work@example.com"

# 在个人仓库目录下单独覆盖（注意：不要加 --global）
cd ~/projects/personal-repo
git config user.name "个人用名字"
git config user.email "personal@example.com"
```

**建议**：个人账号的邮箱用 GitHub 提供的 `用户名@users.noreply.github.com`，可以避免把真实邮箱写进公开的提交历史。

---

## 六、验证配置

```bash
# 验证两个别名分别连到哪个账号
ssh -T git@github.com
ssh -T git@github-personal
```

看到下面这种输出就说明通了（用户名应该分别对应两个账号）：

```
Hi <用户名>! You've successfully authenticated, but GitHub does not provide shell access.
```

**检查某个仓库当前用的是哪个账号**：

```bash
cd 仓库目录
git remote -v                    # 看 remote 用的是 github.com 还是 github-personal
git config user.name             # 看提交署名
git config user.email
```

---

## 七、常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| `Permission denied (publickey)` | SSH 用错了密钥 | 确认 `~/.ssh/config` 里的 `IdentityFile`；确认 remote 用的是正确别名；确认已加 `IdentitiesOnly yes` |
| `ssh -T` 显示的账号和预期不符 | ssh-agent 缓存了多把密钥，SSH 逐个尝试 | `ssh-add -D` 清空后重试；或确保配置里有 `IdentitiesOnly yes` |
| 提交记录里作者是错的账号 | 没设仓库级 `user.email`，用了全局默认 | 在仓库里执行 `git config user.email "正确邮箱"` |
| 同一个仓库换账号后推不上去 | 旧密钥仍被优先使用 | 检查 remote 别名 + 清理 ssh-agent |
| `Bad owner or permissions on ~/.ssh/config` | 文件权限过松 | `chmod 600 ~/.ssh/config` |
| 每次都要输入 passphrase | 没把密钥加入 ssh-agent | `ssh-add --apple-use-keychain ~/.ssh/id_ed25519_work`（macOS） |

---

## 八、日常速查

```bash
# 新增一个仓库时，确认三件事
git remote -v                 # 1. remote 别名对不对
git config user.email         # 2. 提交署名对不对
ssh -T git@github-personal    # 3. 别名连通性

# 把已克隆的仓库从工作账号切到个人账号
git remote set-url origin git@github-personal:用户名/仓库名.git
git config user.name "个人用名字"
git config user.email "personal@example.com"
```

配置好之后，日常操作就是「新仓库克隆时选对别名」，不需要任何切换动作。
