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

### ACPI S0

#### 按需执行
scheduler 是一个用户态调度器。
scheduler thread 定时工作（根据能耗要求），使用 eventfd 唤醒 worker thread。
有\[CPU 核心数\]个 worker threads（使用 affinity 绑在 CPU 上），他们唤醒后开始处理任务。
在 worker thread 没有被唤醒（等待 eventfd）时，内核会自动进入非常深的 idle 状态。

#### iGPU $$\leftrightarrow$$ dGPU 动态数据迁移
思考: 也许集成度更好的系统不需要双 GPU？

### S0ix ($$\approx$$ s2idle)
$$\approx$$ 所有 CPU 进入 C10 且 PCIe 进入 D3hot/D3cold。

有一定的平台自身功耗 (DDR5 self-refresh, SSD, 网卡, 屏幕, ...)

### S4 ($$\approx$$ disk)
- 存在内核内存被任意读写的问题。
- 读取写入量大使其: 1）速度慢；2）磨损固态硬盘
- 用户态可以通过 `madvise(MADV_DONTNEED)` 或 `munmap` 避免成为 hibernation image 的一部分，用户态可以自己实现休眠逻辑（不用存 cache 等等，减少写入量）。

## 附录
### Userspace 自己实现排除 pages 在 hibernation image 之外的可能性测试
简易的测试代码，通过比较时间差异可以判断内核是否排除了 freed pages：
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/mman.h>

int main(int argc, char *argv[]) {
    FILE* fp;
    if (argc < 3) {
        fprintf(stderr, "Usage: %s <size_gb> <mode>\n", argv[0]);
        fprintf(stderr, "  mode: 0=nothing, 1=dontneed, 2=unmap\n");
        return 1;
    }

    size_t size = atol(argv[1]) * 1024 * 1024 * 1024;
    int mode = atoi(argv[2]);

    printf("alloc %luG...\n", size/1024 / 1024 / 1024);

    void *addr = mmap(NULL, size, PROT_READ | PROT_WRITE,
                      MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (addr == MAP_FAILED) {
        perror("mmap");
        return 1;
    }

    printf("make pages dirty...\n");
    memset(addr, 0xAA, size);

    msync(addr, size, MS_SYNC);

    int do_drop = 0;
    switch(mode) {
        case 0:
            printf("do nothing.\n");
            break;
        case 1:
            printf("madvise(MADV_DONTNEED)\n");
            if (madvise(addr, size, MADV_DONTNEED) == -1) {
                perror("madvise");
            }
            break;
        case 2:
            printf("munmap()\n");
            if (munmap(addr, size) == -1) {
                perror("munmap");
            }
            addr = NULL;
            break;
    }

    printf("ready\n");
    system("echo disk > /sys/power/state");
    printf("awake\n");

    exit:
    if (addr) munmap(addr, size);
    return 0;
}
```

### 功耗测试
```sh
#!/bin/bash
read_cpu_uj() { cat /sys/class/powercap/intel-rapl/intel-rapl:0/energy_uj; }
read_total_bat() {
    BATTERY=$(upower -e | grep battery | head -n 1)
    if [ -n "$BATTERY" ]; then
        POWER=$(upower -i "$BATTERY" | grep 'energy-rate' | awk '{print $2}')
        echo "$POWER"
    else
        echo 0
    fi
}

prev_uj=$(read_cpu_uj)
prev_time=$(date +%s.%N)

while true; do
    sleep 1

    # CPU
    cur_uj=$(read_cpu_uj)
    cur_time=$(date +%s.%N)
    dt=$(echo "$cur_time - $prev_time" | bc -l)
    dj=$(echo "($cur_uj - $prev_uj)/1000000" | bc -l)
    cpu_power=$(echo "$dj / $dt" | bc -l)
    prev_uj=$cur_uj
    prev_time=$cur_time

    # GPU
    gpu_power=$(nvidia-smi --query-gpu=power.draw --format=csv,noheader,nounits)
    gpu_power=${gpu_power:-0}

    # 常见假设
    ssd_power=4
    ram_power=3
    scr_power=5

    total_est=$(echo "$cpu_power + $gpu_power + $ssd_power + $ram_power + $scr_power" | bc -l)
    total_bat=$(read_total_bat)
    printf "CPU: %.2f W | GPU: %.2f W | DDR5: %.2f W | SSD: %.2f W | Monitor: %.2f W | Total Est: %.2f W | Total Bat: %.2f W\n" \
        "$cpu_power" "$gpu_power" "$ram_power" "$ssd_power" "$scr_power" "$total_est" "$total_bat"
done
```

测试环境: 机械革命蛟龙16K (Ryzen 7 7435H + RTX 4060 Laptop)

测试数据 (桌面环境):
```
CPU: 8.04 W | GPU: 11.30 W | DDR5: 3.00 W | SSD: 4.00 W | Monitor: 5.00 W | Total Est: 31.34 W | Total Bat: 42.03 W
CPU: 8.05 W | GPU: 10.67 W | DDR5: 3.00 W | SSD: 4.00 W | Monitor: 5.00 W | Total Est: 30.72 W | Total Bat: 42.03 W
CPU: 7.63 W | GPU: 9.80 W | DDR5: 3.00 W | SSD: 4.00 W | Monitor: 5.00 W | Total Est: 29.43 W | Total Bat: 42.03 W
CPU: 8.15 W | GPU: 12.40 W | DDR5: 3.00 W | SSD: 4.00 W | Monitor: 5.00 W | Total Est: 32.55 W | Total Bat: 42.03 W
CPU: 8.65 W | GPU: 13.56 W | DDR5: 3.00 W | SSD: 4.00 W | Monitor: 5.00 W | Total Est: 34.21 W | Total Bat: 36.14 W
CPU: 7.99 W | GPU: 11.29 W | DDR5: 3.00 W | SSD: 4.00 W | Monitor: 5.00 W | Total Est: 31.28 W | Total Bat: 36.14 W
CPU: 7.90 W | GPU: 11.05 W | DDR5: 3.00 W | SSD: 4.00 W | Monitor: 5.00 W | Total Est: 30.95 W | Total Bat: 36.14 W
```
（upower 数据更新比较慢，但是由于没法直接从 sysfs 读，要用 netlink 接口，所以索性直接用 upower 了。）

测试数据 (TTY):
_待测_
