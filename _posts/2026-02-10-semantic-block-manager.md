---
layout:     post
title:      "语义化硬盘块管理系统的设计思路"
date:       2026-02-10T16:59:32+08:00
categories:
---

## 0. 引入

继 Scheduler，这次我来给我的 Userspace OS 设计文件系统。

## 1. 对传统文件系统的反思

传统文件系统的物理存储顺序和结构，与存进去的目录结构息息相关。
然而，很多时候逻辑结构不应与物理结构不应该挂钩。
考虑以下这个场景（伪代码）：

```rust
struct File {
    pub creator: String,
    pub timestamp: Date,
    pub data: Vec<u8>,
} // 虽然写是这么写，但是我们假设这些 Field 都是原地的，而不是 Heap allocation

fn display_metadata(storage: &Storage, id: FileId) { // 需要加载整个 File 逻辑对象
    let file = storage.file(id);
    format!("Author: {} Date: {}", file.creator, file.timestamp)
}

fn display_multiple_metadata(storage: &Storage, ids: Vec<FileId>) { // 多个会加载大量的 data 进来，尽管是垃圾，cache miss，预取几乎失效
    ids.iter()
        .fold("".to_string(), |str, id| str + display_metadata(id))
        .collect::<Vec<_>>()
}
```
以上就是 物理布局 = 逻辑布局 带来的后果。

所以这被迫让写高性能的程序员开始思考：目录结构需不需要写成 SoA (structure of arrays)？

```
|
|-metadata
| |-file_1_meta
| |-file_2_meta
|-data
  |-file_1_data
  |-file_2_data
```

甚至说，对于不同 filesystem 来说，这种优化手段带来的效果还不一定一致。
因此很多大型软件直接选择实现一个程序内的 database。对于普通程序、复杂度比较低的程序，
就没有享受这种优化的资格。

## 2. 设计心路历程

### 2.1 一个逻辑整体，内部应该是分离的
如同上述的例子，File 是一个逻辑主体也是一个寻址主体。

### 2.2 底层不塞 Policies，只放 Primitives
应用层最知道上述例子中的 data 与 metadata 的分离应该怎么做。
可以通过统计或手动标注实现，而不必放在底层作为 Runtime 的一部分。

### 2.3 粒度不清晰，Object 数量爆炸，导致 Metadata Explosion 或 Small Object Problem
存储方式应该与底层硬件的特性紧密相关，而不是一味的提供抽象。
因此想出：分组单位的粒度应该与硬件性能直接挂钩。
我的想法是，提供一个“组”这样的单位，使得: 读取整个“组”与读取单个元素的性能差距相当。
毕竟，现代硬件带宽大，IOPS 小。

### 2.4 想出第一版 Prototype，“引力模型”
Community 是一个读取单位（内容一次性读取和读取单个元素的性能相仿），里面有多个 Node。
Node 可以根据 “引力” 被吸进引力更大的 Community（引力中心），实际是一个加权图。
问题：1）规划（schedule）一个加权图，不用启发式算法，基本上 NP-hard；2）怎么处理“Community 吸引 Community”的问题？

### 2.5 “引力模型”的简化
直接做最简单的决策：对于一个 Node，哪边引力大，直接去那边。

### 2.6 思考落地实践类问题
1. 具体的布局？  
   观现有文件系统：优化“分配时的局部性”，但不会进行主动全局重排优化。  
   举个例子：  
   ```
   [ dir1/file1 - dir1/file2 - dir2/file1 ] （假设 dir1/file1，dir1/file2，dir2/file1 是一起创建的）
   ```
   dir1 有新的文件时直接 append，根本没有连续性可言。因为文件系统不可能去做昂贵的后移操作，这样写入时间不可控。    
   ```  
   [ dir1/file1 - dir1/file2 - dir2/file1 -  dir1/file3 - dir1/file4 ]
   ```  
   因此我决定消除下层的一切不确定性，直接选择显式暴露给上层接口（move 后的引用跟踪自己做；决定放哪里是上层的自由，上层可以根据当前执行的预算判断是否能容忍 move 等操作）
2. 什么抽象值得做？  
   现在看来，是可管理最小单元：1）Node（可以被吸引，可以被多种用途共享）；2）Community（也叫空间上的 Anchor，是单次 IO 的基本单位）。Community 的一个重要 usecase 是优化 dependent 的小文件访问。  
   不值得在这层做的东西有：1）Node 的具体类型（Blob 黑盒更容易管理）；2）Community 之间的关系（不要做 Intra-Block 读写顺序语义，Community 已经是单次读取的单位了，如果要更近一步，最多只能在分配时就用 Hint 把新的 Community 与老的挨近一点）；3）move 语义，上层完全可以做到，但是下层就需要很复杂且完全不可控的引用跟踪了；4）此文件系统非彼文件系统：其实这算是一个 Block Manager，上层可以建立更灵活的语义。

## 3. 最终设计（伪代码展示使用）
```rust
// Block placement
let anchor_candidate = storage.anchor_candidates(sizeclass: Tiny).get(0).unwrap();
let anchor = anchor_candidate.make_anchor();
let block_creation_info = storage.make_block_creation_info(data);
if let Some(block) = anchor.try_accept(block_creation_info) {
    println!("yay! anchor not full.");
} else if let Some(new_anchor_candidate) = storage.anchor_candidates(hints: Hint { near: anchor, results: 8 }, sizeclass: Huge).get(0) { // 可以按需决策选近还是选远，选近就比较贪心（影响其他），选远就当下性能好一点，这是用户的决定
    let new_anchor = new_anchor_candidate.make_anchor();
    new_anchor.accept(block_creation_info);
    println!("uh oh, created nearby anchor..");
} else if let Some(new_anchor_candidate) = storage.anchor_candidate(sizeclass: Huge) {
    let new_anchor = new_anchor_candidate.make_anchor();
    new_anchor.accept(block_creation_info);
    println!("oops, space too tight...");
} else {
    println!("disk is full!");
}

// Move semantics
let (anchor_a, anchor_b) = params;
if anchor_b.remaining() / anchor_b.capacity() <= 0.5
    && anchor_a.remaining() / anchor_a.capacity() <= 0.5 { // naive impl for demonstration
    let blocks = anchor_b.read_all();
    anchor_b.destroy(); // 自行跟踪 anchor_b -> anchor_a
    anchor_a.accept_multiple(blocks);
}
```
