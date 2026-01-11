---
layout:     post
title:      "编译器框架设计的一点想法"
date:       2026-01-10T21:52:21+08:00
categories: idea
---

draft area:
- compiler 和 普通程序同等对待
- 基于数据结构的特化
- range based



## Control Flow Range 选取

代码控制流中，有些是
- 一定会发生
- 可能会发生 - 可以在较极端情况下 (特别是对于配置) 演变为 assert guards + fallback 解释器路径

- Compiler Sea of Nodes Graph 怎么选取范围（我们不可能将程序整个作为 Sea of Nodes）
- Cfg 中一个Node可能会发生的概率， "基于控制流分析的实现特化"

## 基于概率的代码复用特化

```rust
fn work(config_A: bool) {
    if config_mode { do_workA() } else { do_workB() } // 无法优化，概率是五五开的，除非 inline 消除常量 branch
}

for i in 0..N {
    work(true);
    work(false);
}
```

针对这种分支，分裂为三个 Profile:
- True Profile
- False Profile
- Common Profile

当 True/False 发生采样事件时，会按照 True/False 所占概率为权重对 Common Profile 进行"传播"。

注: 将 `work` 纳入 Sea of Nodes 图很多时候是不现实的 (纳入=inline)，特别是 caller (或 user) 很多的时候

## 基于控制流分析的实现特化

prior implementations:
- v8 的 array [holey (as integer map), packed, smi]
- stl std::vector<bool> 特化实现 (bit_vector)

基础用法: 判定某一种特殊的 "usage" 是否存在

NeverUsed // 非 dead code 区域没有这种用法
MayUsed // 在 sample 后发现属于“几乎不可能分支”
MustUsed

(数据结构也可以有三种)

怎么判断是否存在: 非 dead-code 区域

let vec = Vec::new()

## Hierarchy

### Runner (backend)
- 提供基本数据类型，允许建构基础数据结构，支持基础的 typing
- 支持基础的操作
- 此层可以用现有 Wasm Runtime

### Runtime
- 在此层实现 Object 数据类型
- 版本管理在这个层面进行 (比如 Object 的设计也可以设计多个版本)
- 动态链接时可以要求 Compiler 前来插手

### Compiler
用于动态链接或程序预编译
处理

---

### Maintain 任务

### Object
封装了如 allocator 等溯源性信息

---

Glossary (有些词不知道怎么说，就在这里定义/解释一下了...):

## Linear

一种图，其节点必须是最小单位且节点不能表示不同的执行路径

## Edge-Conditioned CFG (EC-CFG)

Linear Edge-Conditioned CFG: (LEC-CFG)
Node 严格不包含条件（不包含），只有 Edge 是条件
> 用于微观的指令级微操
