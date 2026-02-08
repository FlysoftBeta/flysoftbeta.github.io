---
layout: post
title: "更快、高能效的节能方案"
date: 2026-02-08T12:05:07+08:00
categories:
---

## 背景介绍

1. Linux kernel 的调度器是基于 runnable task 的，很多软件会因为有事件产生而 _饥饿地_ 将自己加入内核scheduler的runnable queue，导致 CPU 难以进入 idle 状态（更深的 C-states）。更深的 C-states 往往带来更多能耗节省，但是也极大增加的唤醒延迟。Linux 的 cpuidle subsystem 对于这个问题靠预测下次唤醒的时间，选择适合的 C-state。
2. 我在 [目标导向的 Userspace Scheduler 建模](https://flysoftbeta.top/posts/2026-02-07-userspace-modeling/){:target="\_blank"} 曾经介绍过以 uTarget 驱动的调度器的设计，这种设计可以统一控制节奏，例如全局的呈现节奏，有效避免无效的中间计算。
3. 一个很有趣的能效目标是: “鼠标不动，CPU不转”。

## 问题

1. 首先，Linux kernel 的 cpuidle subsystem 是被动预测时长，并未参与到 scheduler 的决策  
   对策: 我的 scheduler 可以做 batch-aware，批处理任务，然后陷入长期的 idle
2. uTarget 的约束太硬性  
   对策: uTargetCoordinator 综合考虑计算资源的“预算”，比如 CPU 占空比不小于某个数值；还可以考虑诸多因素。

## 具体实现

scheduler 是一个用户态调度器。
scheduler thread 定时工作（根据能耗要求），使用 eventfd 唤醒 worker thread。
有\[CPU 核心数\]个 worker threads（使用 affinity 绑在 CPU 上），他们唤醒后开始处理任务。
在 worker thread 没有被唤醒（等待 eventfd）时，内核会自动进入非常深的 idle 状态。
