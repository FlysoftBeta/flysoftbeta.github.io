---
layout:     post
title:      "在 Windows VM 内实现共享 Compositor 的设计与实现"
date:       2026-01-11T01:28:45+08:00
categories: windows vm os gpu
---

# 背景

在设计端侧操作系统时，一直以来，Windows 兼容性都是一大难题。

Wine 等方案可以说作用十分有限。可以说，如果不是游戏界几乎只用
Unity/虚幻 这几个相对固定的引擎，那么 Wine 对游戏的兼容性就没有这么广了。

因此，我认为要跑 Real-world Application，还得靠完整 VM。

然而完整 VM 通常在消费级硬件上 (特别是 NVIDIA/AMD GPU，Intel Arc 除外)，
没有天生的 paravirtualization 支持，导致必须通过 VirGL 这种
软件手段进行冗长的、round-trip 的转发。

- VirGL 路径可以概括如下: Windows UMD (universal) -> 
Windows KMD (universal) ->Linux kernel VMExit handler ->
Linux UMD (vendor) -> Linux KMD (vendor) -> Hardware
- 这是单机的路径: Linux UMD (vendor) -> Linux KMD (vendor) -> Hardware
- 这是硬件虚拟化 SR-IOV 的路径: Windows UMD (vendor) -> 
Windows KMD (vendor) -> Hardware 
(VF driver 直接写 VF BAR，没有 Hypercall/VMExit)
- 这是微软 WDDM 模型下的软件半虚拟化 GPU-PV 的路径: Guest Windows UMD -> 
Guest Windows KMD -> Host Windows KMD (dxgkrnl 设计允许 Kernel - kernel 的转发，
好歹少了两次 context switch)

可见，没有不需要硬件特殊设计或厂商在软件上的协作的特别高效的传统方案。

# 设计概述

由于我的 OS 的 Runtime 可以进行一些工作，这些可以使程序及其上下文跨地址空间
乃至跨网络切换执行环境，这使得: Compositor 可以呆在 Windows VM 里面，
而不必传递冗长的 Draw Commands (传递抽象的而不是具象的)。

考虑到 Windows 多年来成熟的图形栈，本文提出让 Windows 接管 GPU，
让 Host program 向其中反向发送绘制指令的做法。

这可以拆解为几个问题:
1. Host/Guest之间的协议怎么设计 (共享内存/hypercall/同步)
2. 怎么实现 Windows 端的 compositor， 
第一，让我获得 Display 的 ownership，而不是交给 DWM 进行混成； 
第二，高效地抓取应用程序的画面；
...
3. 怎么优化用户体验？ 
第一，减少 GPU ownership 转移导致的 modesetting； 
第二，避免 Windows 图形栈损坏而无法显示正常系统 (防止第三方 app/用户手动修改显示设置)； 
第三，快速地自动地安装 Windows 本体 (unattended)/显示驱动

# Compositor 的实现

先来考虑 compositor 的实现问题。

独占问题可以通过 [specialized display](https://learn.microsoft.com/en-us/windows-hardware/drivers/display/specialized-monitors){:target="_blank"} 实现。

首先标记物理显示器为 specialized display (需要 guard 保护这个设置项):
```cpp
// Undocumented Structure，等同于在设置内启用“将此显示器从桌面删除”
typedef struct DISPLAYCONFIG_MONITOR_SPECIALIZATION {
  DISPLAYCONFIG_DEVICE_INFO_HEADER header;
  union {
    struct {
      UINT32 isSpecializationEnabled : 1;
      UINT32 reserved : 31;
    } DUMMYSTRUCTNAME;
    UINT32 value;
  } DUMMYSTRUCTNAME;
} DISPLAYCONFIG_SUPPORT_VIRTUAL_RESOLUTION;

void SetMonitorSpecialized(LUID adapterId, UINT32 targetId, bool enable) {
    DISPLAYCONFIG_MONITOR_SPECIALIZATION setInfo = {
        .header = {
            .type = DISPLAYCONFIG_DEVICE_INFO_SET_MONITOR_SPECIALIZATION,
            .size = sizeof(setInfo),
            .adapterId = adapterId,
            .id = targetId,
        },
        .isSpecializationEnabled = enable ? 1 : 0,
    };
    LONG result = DisplayConfigSetDeviceInfo(&setInfo);
    // ...
}
```

再创建一个 Indirect Display Driver (IDD)，将传统桌面的
所有内容都放在上面。(Windows 至少需要一个显示器用于显示桌面)

使用 windows.graphics.capture (wgc) 捕获窗口并提交到混成器。

混成器通过 windows.devices.display.core 独占显示器。([示例实现](https://github.com/microsoft/Windows-classic-samples/tree/main/Samples/DisplayCoreCustomCompositor){:target="_blank"})

实现待定...
