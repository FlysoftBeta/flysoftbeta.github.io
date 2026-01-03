---
layout:     post
title:      "Sea of Nodes Graph 的存储优化即为调度问题"
date:       2026-01-03T22:59:28+08:00
categories:
---

在基于 Sea of Nodes 的编译器工作过程中，
Graph 不可避免地要进行存储。而与时间顺序类似（一维的），
内存空间同样是一维的。而内存也恰巧有越近越可能 Cache Hit 的特性。
因此，即使是在编译器工作过程中，如果我们要优化编译器本身的性能，
那么优化 Graph 的存储也是一个 Minimum Linear Arrangement (MLA)
调度问题 (本质是 NP-hard 的)。

在我看来，编译器实现自举是十分重要的。
编译器本身也是一个软件，也需要编译器算法带给它的优化，
像上文的 MLA 的优化就完全可以封装起来用。
因此自举也是 [Windcharge 引擎](/windcharge) 的一重要目标。
