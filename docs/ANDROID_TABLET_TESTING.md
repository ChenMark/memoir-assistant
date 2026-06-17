# Android 平板真机测试报告

## 测试设备清单（建议覆盖）

### 主流机型（必测）
| 设备 | 系统 | 浏览器 | 备注 |
|------|------|--------|------|
| 华为 MatePad 11 (2023) | HarmonyOS 3.0 | 华为浏览器 | 字体 HarmonyOS Sans SC |
| 华为 MatePad Pro 13.2 | HarmonyOS 4.0 | 华为浏览器 | 大屏 + 鸿蒙原生 |
| 小米 Pad 6 | MIUI 14 | MIUI 浏览器 | 字体 MiSans |
| 三星 Galaxy Tab S8 | OneUI 5 | Samsung Internet | DeX 模式 |

### 入门机型（必测性能）
| 设备 | 系统 | 浏览器 | 备注 |
|------|------|--------|------|
| 联想小新 Pad Plus 2023 | ZUI 13 | Chrome | 4GB RAM · 性能边界 |
| 华为 MatePad SE 10.4 | HarmonyOS 3 | 华为浏览器 | 入门机 |

### 微信/QQ 内嵌（场景测试）
| 入口 | 优先级 |
|------|--------|
| 微信内置浏览器 | P1 |
| QQ 浏览器 | P2 |
| UC 浏览器 | P3 |

## Chrome DevTools 模拟（开发期）

DevTools → Toggle device toolbar → 选择：
- `iPad` (基准对照)
- `iPad Pro` (大屏)
- `Responsive` (手动拖到 840×1200)

⚠️ 模拟器**不能替代真机**：
- 字体渲染（HarmonyOS Sans vs Roboto）
- 摄像头方向（real device 会镜像）
- Web Speech（部分 Android 模拟器无麦克风）
- 性能（模拟器通常比真机流畅）

## 关键测试场景

### 1. 摄像头采集
```
✅ 后置 1080p 取景清晰
✅ 翻转镜头（前置/后置）流畅
✅ 录像 60 秒自动停止
✅ 拍照快门响应 < 500ms
✅ Android 10+ 设备拒绝权限时给出明确提示
```

### 2. Web Speech 降级
```
测试用例 A (iOS Safari):
  → native 模式可用
  → 实时显示中文文字

测试用例 B (Android Chrome, 现代):
  → native 模式可用
  → 实时显示中文文字

测试用例 C (Android Chrome, 老机型):
  → 2.5s 探测超时
  → 自动降级 server 模式
  → 提示 "使用服务端识别"

测试用例 D (HarmonyOS 浏览器):
  → 直接进入 server 模式
  → 无 SpeechRecognition API
```

### 3. 软键盘适配
```
✅ 输入框 focus 时上推
✅ Android 9+ 设备不会遮挡
✅ 关闭键盘后视口恢复
```

### 4. 横竖屏切换
```
✅ 平板横屏 → 双栏布局
✅ 平板竖屏 → 紧凑布局
✅ 切换不丢失状态
✅ 摄像头采集横屏 → 居中取景
```

### 5. 性能（千元机）
```
目标：联想小新 Pad Plus (Snapdragon 680, 4GB RAM)
✅ 首屏 LCP < 2.0s（3G 网络模拟）
✅ 触摸响应 < 100ms
✅ 摄像头预览帧率 24fps+
✅ 应用内存 < 120MB
```

## 已知问题（暂不修复）

1. **HarmonyOS 3 某些版本 Web Speech API 存在但不可用** — 已通过探测超时降级
2. **MIUI 14 浏览器对 getUserMedia 后置摄像头默认不优先** — 需要 `facingMode: { exact: 'environment' }`
3. **微信内置浏览器（X5 内核）** MediaRecorder 部分机型返回空数据 — 提示用户用浏览器打开

## 兼容性矩阵速查

| 浏览器/系统 | getUserMedia | MediaRecorder | Web Speech | VisualViewport |
|-------------|--------------|---------------|------------|----------------|
| iOS Safari 16+ | ✅ | ✅ | ✅ | ✅ |
| Android Chrome 100+ | ✅ | ✅ | ⚠️ 探测 | ✅ |
| Android Chrome < 100 | ✅ | ✅ | ❌ | ✅ |
| HarmonyOS 浏览器 | ✅ | ✅ | ❌ | ✅ |
| 微信 X5 内核 | ⚠️ | ⚠️ | ❌ | ⚠️ |
| 三星 Internet | ✅ | ✅ | ⚠️ | ✅ |

图例: ✅ 原生支持 / ⚠️ 部分场景 / ❌ 不支持
