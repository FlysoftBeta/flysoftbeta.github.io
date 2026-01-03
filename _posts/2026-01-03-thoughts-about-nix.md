---
layout:     post
title:      "从 Haskell 构建失败到 Nix：Nix到底适合用来干啥？"
date:       2026-01-03T11:53:46+08:00
categories: thoughts nix nixos package-manager os
---

最近在尝试构建一个基于 Haskell 的[编程语言原型项目](github.com/SchrodingerZhu/reussir)，却在环境配置上吃了苦头。由于该项目对依赖版本要求极严，即便我多次尝试用 `ghcup` 调整环境，依然卡在了 MLIR 的版本兼容性上。

正当准备放弃时，发现项目支持 Nix Flakes。抱着死马当活马医的心态试了一把，结果构建过程异常顺畅。借此机会，简单聊聊我对 Nix 的看法。

## 优势：环境隔离与复现的终极方案

对于依赖复杂的项目，Nix 可能是目前最优雅的解法。

使用传统发行版（特别是像 Manjaro 这种滚动更新的系统）做开发时，经常面临一个痛点：**系统库版本太新，而项目依赖太旧。**

这让我想起去年夏天分析 V8 引擎 exploits（基于几年前的 commit `2ad0a63`）时的惨痛经历：
1.  在本地构建，Manjaro 的系统依赖太新，无法编译。
2.  基于我对 Windows 的兼容性比 Linux 好的判断，切换了 Windows，试图在 Windows 上构建，却陷入了配置 Python 2（零几年的古董环境）的大坑，还把我环境搞乱了
3.  最终只能切回 Linux，用 Docker 跑了一个 Debian Buster 容器才勉强构建成功。

虽然 Docker 能解决问题，但相比之下，Nix 的体验简直是降维打击，基本是一键的

```sh
sh <(curl --proto '=https' --tlsv1.2 -L https://nixos.org/nix/install) --daemon
echo "experimental-features = nix-command flakes" >> /etc/nix/nix.conf
nix develop
```

## 门槛：陡峭的学习曲线与碎片化

虽然 Nix 在开发环境配置上表现不错，但我之前尝试将 NixOS 作为主力系统时，体验却并不美好，很显然，NixOS 有很大的问题：

1.  与现有的生态割裂:
    由于 NixOS 不遵循 FHS（文件系统层次结构标准），还不支持 static-linking，导致许多预编译的二进制程序（如 Linux版QQ、微信）无法直接运行，
    连 AppImage 格式都没法战胜这些奇特的目录结构。
    

2.  自己与自己矛盾:
    flake 到现在竟然还是 experimental 的，你说它默认启用都比在 feature flag 后面好，这让生产环境人的开还是不开？是不是说明 flakes 还不是推荐用法？
    我仅仅是为了“安装一个包”，在 Nix 生态中就有无数种写法，让人无所适从：
    *   是写在 `systemPackages` 里全局安装？
    *   还是用 Home Manager 放在 `home.packages` 里？
    *   只是开发用？那应该在 `devShell`。
    *   ...

3.  不直观的配置修改:
    直到现在，Nix 配置还是要手改。对于 `pacman -S foo` 这种，在 Nix 的世界观里面完全可以修改 `configuration.nix` 在里面 append 一句。
    诶，可是它就是认为修改 `configuration.nix` 是不纯的。这种对问题糟糕的观点导致它完全没有便利性可言。

## 结语

Nix 就像一把双刃剑。作为开发工具，它是解决环境可复现性的利器；但作为NixOS操作系统，它要求用户必须全盘接受其洁癖般的世界观，
这在任何情况下都没有丝毫可行性。也许 Nix 最好的归宿是单个项目的依赖管理罢。
