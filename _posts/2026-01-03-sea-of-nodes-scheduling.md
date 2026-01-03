---
layout:     post
title:      "Sea of Nodes Graph 的存储优化即为调度问题"
date:       2026-01-03T22:59:28+08:00
categories:
---

基于 Sea of Nodes (SoN) 的编译器工作过程中，我们能见到一个叫做 Schedule 的 Pass (C2 对 MachGraph 调度)，
这本质上就是 flattening，但是目标函数是：
- 低寄存器压力，防止太多 spill 到栈上
- 指令 lantency，充分利用乱序多发射 CPU 的优势
这就是为什么 C2 要进行 Global/Local Code Motion。

但即使是编译器自身工作过程中，Graph 不可避免地要进行存储。
而与时间顺序类似（一维的），内存空间同样是一维的。
而内存也恰巧有越近越容易 Cache Hit 的特性。
因此，即使是在编译器工作过程中，如果我们要优化编译器本身的性能，
那么优化 Graph 的存储也是一个 Minimum Linear Arrangement (MLA)
调度问题 (本质是 NP-hard 的)。如果这个问题也能被通用启发式手段优化，
那么确实会造成不小的性能提升 (有可能用在 JIT 里面)。

在我看来，编译器实现自举是十分重要的。
编译器本身也是一个软件，也需要编译器算法带给它的优化，
像上文的 MLA 的优化就完全可以封装起来用。
因此自举也是 [Windcharge 引擎](/windcharge){:target="_blank"} 的一重要目标。
