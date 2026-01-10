---
layout:     post
title:      "图优化不只是一个最小线性排列问题"
date:       2026-01-09T23:38:37+08:00
categories: graph compiler optimization
---

_status: draft (as of 2026/1/10 16:02)_

图存储是将复杂的图 flatten 到一维的空间里面。

要优化他的顺序，本质上可以认为优化以下目标函数:

$$ \min \sum_{(u, v) \in \mathcal{T}} \text{cost}(addr(u), addr(v)) $$

即对于所有**访问对**，寻找一个 $$\mathcal{addr}$$，使得总代价最小。

为了简化，cost 很多时候被定义为 $$\text{cost}(x, y) = \|x - y\|$$，这时候问题就是一个线性的最小线性排列问题(MLA)问题(尽管如此，问题仍然是 NP-hard 的)。

然而，现实中，cost 是一个阶跃的函数，即，数据是显式地分 Tier 的。例如，在 L1 Cache "边缘"和在 L1 Cache 之外的 cost 函数是完全不同的。

此外，对于访问对，不一定只是相邻的，对于在访问时间顺序上跨了一定距离的访问对，也有很大的价值。现实情况比这复杂的多。

一些现有研究:

- 滑动窗口法 GOrder, Rabbit Order —— _让时间轴上的信息更为丰富_

TO BE DONE.

<!--10lhe5Im44HlLT6UtW2XCPDazzd05z1lO-->
