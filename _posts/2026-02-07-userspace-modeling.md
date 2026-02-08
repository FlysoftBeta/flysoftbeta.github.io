---
layout:     post
title:      "目标导向的 Userspace Scheduler 建模"
date:       2026-02-07T22:26:14+08:00
categories:
---

## 概念

- uTask （Hints: uCtx）
- uTarget
- uTaskSolver
- uTargetCoordinator

## 核心要义

- “呈现”是最终目的，以 uTarget 为终点串起这些 uTask。
- 与 CFS 的比较: Completely Fair Scheduler (CFS) 的设计是基于公平性而言的，由于语义缺乏，它并不知道怎么样不损害“呈现”实时性的同时避免 cache miss/context switch带来的开销，所以当然只能靠保障 fairness 来调度。

### “呈现”概念的单独介绍

- 例子: GUI层面: Compositor Swapchain Present（用户直接看到了）；渲染任务（用户直接感受到了完成快）
- 不同的目的可以有不同的参数，比如Present这个目的就可以根据场景调节一个参数: freq 决定吞吐量 (多少帧) + latency 决定整条链可以被拉得多长 (显示延迟)

## uTask

### uTask 的粒度选择

- Task 被设计为: 当需要并行时 split（传统的 fork-join 模型）；
- 当存在超长距离依赖时切割，如 渲染完画面后 compositor 只对这个画面感兴趣，不对之后的感兴趣；
- uTask 不会因为抢占、safepoint、cache miss 而被自动拆分，这些会使优化引入完全没必要的复杂度。

```rust
fn render() {
    let image = make_beautiful_images();
    submit_to_compositor(image);
    do_sth_else(); // compositor 并不关心 do_sth_else
}
```

## uTaskSolver

### 设计背景

- 有 uTargetCoordinator 给出的这么多的约束要满足，那么需要一个权衡者，权衡优化 Hints，任务DAG的顺序，任务的 deadline 等等。
- uTaskSolver 的算法不止一种，单独拎出来可以给更多不同的场景定制。

### 优化用的抓手

- 任务顺序（为了uCtx更连续可以连续处理一条链上的好多个节点）
- CPU 的占空比 (没错，这个与传统的不同，这个是根据任务目标调节的！)。

### 最终的优化目标

- 增强连续性: uTask switch (对应传统系统的 context switch) 轻量，但是 uCtx 的不重合会导致 cache miss（uCtx只是一个Hint，不是一等公民），在数据库的 scenario 里面，可能就是批量提交的队列什么时候满的问题，越早满越可以早点 flush
- 尽可能达到 uTarget 设置的目标，如吞吐量、延迟（从链头到链尾的时长）

## uTargetCoordinator

### 设计背景
- 如果一味的为了满足 uTarget 设置的 Hard Constraint，其他任务可能完全没有被调度的机会；
- 例如，尽管一台电脑跑游戏A只能跑 30FPS，但是 uTarget 设置了必须跑到 60FPS，那么可能只有游戏A的 uTask 可以运行，其他后台任务都会饿死。
- 与 uTaskSolver 类似，uTargetCoordinator 的算法不止一种，单独拎出来可以给更多不同的场景定制，否则上限就被锁死在那里了。

### 设计目的

协调不同 uTarget 之间的关系
- 例如，可以设置全机工作模式（节能/高吞吐/高性能），而不是一味追求性能
- uTarget 通过 protocol 与 uTargetCoordinator 协商自己任务的参数
