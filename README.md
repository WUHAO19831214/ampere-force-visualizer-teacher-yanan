# Physics Multi-Source Experiment Bridge

中文名：物理实验多源数据采集与三维可视化平台

这是一个面向高中物理课堂实验的网页 MVP。第一版目标是跑通：

屏幕捕获 → ROI 区域框选 → 数字识别接口 → 实时数据面板 → 数据存储 → CSV 导出  
摄像头捕获 → 实验画面显示 → 视觉分析 ROI → Mock 视觉数据 → CSV 导出  
右侧下方预留 3D 虚拟实验与教学可视化区域

## 运行方法

```bash
npm install
npm run dev
npm run build
```

开发服务器启动后，打开终端中显示的本地地址，通常是：

```text
http://localhost:5173
```

## 浏览器网页阶段的重要限制

左侧区域不是系统级透明窗口，也不能真正“透视”到底层正在运行的数字化实验软件窗口。

纯浏览器网页不能随意透明覆盖其他软件窗口，也不能静默读取桌面内容。当前 MVP 使用浏览器 Screen Capture API：

1. 点击“开始捕获屏幕”；
2. 浏览器弹出授权窗口；
3. 手动选择要捕获的屏幕、窗口或浏览器标签页；
4. 网页左侧显示被授权捕获的画面；
5. 在左侧捕获画面上拖拽、缩放 ROI；
6. 程序按 ROI 的采样频率调用数字识别接口。

后续桌面增强版可以考虑 Tauri 或 Electron，实现窗口置顶、半透明窗口、局部透明、覆盖在原实验软件上方等更接近“屏幕数据采集仪”的体验。

## 当前已实现

- Vite + React + TypeScript 项目结构。
- 三栏布局：左侧屏幕 ROI、中间摄像头、右侧数据与 3D 区域。
- 左侧/中间、 中间/右侧分割条可拖拽。
- 右侧实时数据区与 3D 区域上下比例可拖拽。
- 布局比例保存到 localStorage，刷新后保留。
- 左侧 Screen Capture API 屏幕捕获。
- 三个默认屏幕 ROI：F1、F2、F3，适配朗威 DIS 类数字区域校准。
- 每个屏幕 ROI 拆分为绿色 `displayRoi` 和黄色 `ocrRoi`。
- ROI 支持拖拽、缩放、启用/停用和配置。
- 屏幕数字识别接口：mock、tesseract、template-digit、cnn-onnx。
- 默认实时识别方法已改为 `tesseract`，用于读取 F1、F2、F3 的真实屏幕数字。
- `mock` 仍保留在 OCR 方案对比面板中，只作为模拟对照。
- Tesseract.js 已接入，`tesseract` 方法会裁剪黄色 `ocrRoi` 后进行本地 OCR。
- OCR 调试面板会显示裁剪原图、预处理图、rawText、value、confidence、durationMs、校验结果和 warning。
- OCR 调试面板提供“测试当前 ROI OCR”按钮，可对当前 ROI 单独执行一次真实 Tesseract 识别，不写入正式实时数据。
- OCR 调试面板显示 Tesseract 状态：未加载、加载中、已就绪、识别中、错误。
- 右侧实时数据总览会显示 Tesseract 的 `rawText`、置信度、OCR 耗时和最近更新时间。
- 中间摄像头打开、关闭、设备选择、截图下载。
- 摄像头视觉 ROI 支持拖拽、缩放、启用/停用和配置。
- 摄像头视觉分析接口：mock、color-tracking、template-matching、marker-tracking、optical-flow。
- 当前 mock 视觉分析会模拟目标坐标、位移、速度、角度、角速度。
- 右侧实时显示屏幕数字数据、摄像头视觉数据、状态、FPS、分辨率和 warning。
- 支持导出屏幕数据 CSV。
- 支持导出摄像头数据 CSV。
- 右侧下方 3D 虚拟实验与可视化区域占位。

## 如何使用

### 启动屏幕捕获

点击左侧“开始捕获屏幕”，在浏览器弹出的授权窗口中选择正在显示数字化实验软件的窗口、屏幕或标签页。授权后画面会显示在左侧。

### 调整屏幕 ROI

左侧默认有三个 ROI：F1、F2、F3。绿色框是 `displayRoi`，用于标记整条数据区域；黄色框是 `ocrRoi`，只用于数字识别。直接拖动绿色框可移动整条显示区域，拖动黄色框可微调真正送入 OCR 的数字区域，拖动右下角白色小柄可缩放。展开“屏幕 ROI 配置”后，可以修改 channelId、名称、符号、单位、小数位、采样频率、识别方法、平滑滤波、异常跳变过滤、物理合理性范围和启用状态。

左侧屏幕捕获画面区是固定高度区域，下方配置和 OCR 调试面板会在独立容器内滚动，不会再挤压上方预览画面。ROI 坐标以原始视频画面的 0 到 1 归一化坐标保存，显示和裁剪时再映射到当前视频尺寸。

屏幕显示模式支持：

- `contain`：完整显示捕获画面，允许黑边；
- `cover`：尽量填满预览区，减少黑边，允许裁掉部分边缘；
- `manual-crop`：接口已预留，当前按完整显示处理。

### 打开摄像头

点击中间“打开摄像头”，授权后显示真实实验场景。可以在设备下拉框中选择内置摄像头或 USB 外接摄像头。点击“截取当前画面”可保存当前帧为 PNG。

### 调整摄像头视觉 ROI

点击“添加视觉分析区域”可新增视觉 ROI。拖动 ROI 框可移动，拖动右下角小柄可缩放。展开“摄像头视觉 ROI 配置”后，可以修改名称、分析方法和启用状态。

### 调整布局

拖动两条竖向分割条可调整三栏宽度。拖动右侧中间的横向分割条可调整实时数据区与 3D 可视化区高度。点击顶部“重置布局”可恢复默认比例。

### 切换识别方法

屏幕 ROI 配置中可选择：

- `mock`：当前可用，用于开发调试；
- `tesseract`：当前可用，使用 Tesseract.js 本地 OCR，只识别黄色 `ocrRoi`；
- `cnn-onnx`：轻量 CNN / ONNX 本地推理接口预留，当前 MVP 未接入模型。
- `template-digit`：固定字体模板识别器预留，适合后续优化朗威 DIS 大号固定字体数字。

三种主要识别方法严格分离：`mock` 只产生模拟值；`tesseract` 必须调用真实 Tesseract.js，不会失败后自动回退 mock；`cnn-onnx` 当前只显示未接入占位。

摄像头视觉 ROI 配置中可选择：

- `mock`：当前可用；
- `color-tracking`；
- `template-matching`；
- `marker-tracking`；
- `optical-flow`。

除 mock 外，视觉方法目前均为接口占位，后续接入真实算法。

### 查看实时数据

右侧上方会显示：

- 屏幕捕获状态；
- 摄像头状态；
- OCR 状态；
- 屏幕实际采样频率；
- 摄像头 FPS；
- 摄像头分辨率；
- warning 信息；
- 每个屏幕 ROI 当前识别方法、实际采样频率、OCR 耗时和失败次数；
- 屏幕 ROI 最新值；
- 摄像头视觉分析最新值。

## 如何比较 OCR 方案

右侧“实时数据总览”下方提供“OCR 方案对比”面板，用于对同一个当前选中的屏幕 ROI 同时测试多种识别方法。单次测试结果不会自动写入实时数据流。

1. 启动屏幕捕获。
2. 调整绿色 `displayRoi` 和黄色 `ocrRoi`。
3. 确认裁剪原图和预处理图中数字清晰、没有单位和边框干扰。
4. 在左侧选中当前 ROI，例如 F1。
5. 打开右侧“OCR 方案对比”面板。
6. 点击“测试全部 OCR 方法”。
7. 比较 `mock`、`tesseract`、`template-digit`、`cnn-onnx` 的 rawText、value、confidence 和 durationMs。
8. 如果 Tesseract 能正确识别，点击 Tesseract 卡片中的“采用此方法作为实时识别方法”。
9. 如果 Tesseract 不稳定，后续可继续完善 `template-digit` 或 `cnn-onnx`。

对比面板中的四种方法相互独立：`mock` 只用于模拟对照；`tesseract` 会调用真实 Tesseract.js；`template-digit` 当前是朗威固定字体模板匹配占位；`cnn-onnx` 当前是本地轻量模型占位。

## 如何校准 OCR ROI

朗威 DIS / DISLab 类软件里，数字通常很大且位置稳定。为了提高识别准确率，请优先校准黄色 OCR 内框。

1. 先点击“开始捕获屏幕”。
2. 在浏览器授权窗口中选择朗威软件窗口，或者选择整个屏幕。
3. 把绿色 `displayRoi` 框放到整条数据区域，方便观察该通道属于 F1、F2 还是 F3。
4. 把黄色 `ocrRoi` 框只框住数字本身，例如只框住 `2.15`。
5. 不要把 `F1`、单位 `N`、按钮、边框、彩色线条、背景网格或其他文字框进黄色区域。
6. 在“屏幕 ROI 配置”中把识别方法切换为 `tesseract`。
7. 打开“OCR 调试面板”。
8. 查看“裁剪原图”和“预处理图”是否只包含清晰数字。
9. 如果识别不准，微调黄色 `ocrRoi` 的位置和大小，让数字尽量居中且不要截断小数点。
10. 必要时把采样频率降到 2 Hz 或 3 Hz，提高稳定性。

Tesseract 当前字符白名单为：

```text
0123456789.-
```

当前版本暂不启用 `E/e` 科学计数法识别，因为朗威界面主要显示普通小数，允许 `E/e` 反而容易引入误识别。

## 当前推荐实时识别方案：Tesseract OCR

当前测试中，Tesseract OCR 已能正确识别朗威 DIS 屏幕数字。默认 F1/F2/F3 的实时识别方法已改为 `tesseract`，采样率建议先保持 1 到 2 Hz，稳定后再提高。

右侧实时数据总览默认显示真实 Tesseract 结果：

- 数值与单位；
- 来源：`tesseract`；
- `rawText`；
- 置信度；
- OCR 耗时；
- 最近更新时间。

如果 Tesseract 识别出 `2.335`，而屏幕显示两位小数 `2.33`，可以通过 ROI 配置中的：

- `decimalPlaces` 控制显示小数位；
- `roundingMode` 选择四舍五入或截断。

例如：

- `round`：`2.335` 显示为 `2.34`；
- `truncate`：`2.335` 显示为 `2.33`。

`mock` 只是模拟数据，不代表真实 OCR；`template-digit` 和 `cnn-onnx` 是后续提高稳定性和速度的优化方向。

## 朗威数字识别校准方法

1. 启动屏幕捕获。
2. 选择朗威 DIS 软件窗口或整个屏幕。
3. 设置屏幕显示模式为 `cover`，减少黑边，让有效数据区域更大。
4. 用绿色 `displayRoi` 框住整条数据区域，方便确认通道。
5. 用黄色 `ocrRoi` 只框住数字本身，例如 `3.23`、`2.96`、`2.54`。
6. 不要把 F1/F2/F3、单位 N、边框、按钮、背景线条框进黄色区域。
7. 在 ROI 配置中把识别方法从 `mock` 切换为 `tesseract`。
8. 打开 OCR 调试面板。
9. 点击“测试当前 ROI OCR”，确认 Tesseract worker 是否加载并返回真实 rawText。
10. 查看裁剪原图和预处理图是否只包含清晰数字。
11. 如果识别不准，微调黄色 OCR 框，特别注意不要截掉小数点。
12. 尝试切换 `preprocessMode`：`grayscale-threshold`、`high-contrast`、`invert`、`color-number`。
13. Tesseract 采样率建议先设为 1 到 3 Hz，不要一开始设 10 Hz。

### 导出 CSV

右侧上方有两个导出按钮：

- 导出屏幕数据 CSV；
- 导出摄像头数据 CSV。

屏幕数据字段：

```text
timestamp,source,channelId,name,symbol,value,unit,method,confidence,rawText,warning
```

摄像头视觉数据字段：

```text
timestamp,source,roiId,name,x,y,angle,displacement,velocity,angularVelocity,method,confidence,warning
```

## 代码结构

```text
src/
  main.tsx
  App.tsx
  types/
    physics.ts
    vision.ts
    experiment.ts
  components/layout/
    ResizableThreePanelLayout.tsx
    ResizableSplitPane.tsx
  screen/
    ScreenCapturePanel.tsx
    RoiOverlay.tsx
    RoiBox.tsx
    RoiConfigPanel.tsx
  camera/
    CameraCapturePanel.tsx
    CameraOverlay.tsx
    VisionRoiBox.tsx
    VisionConfigPanel.tsx
  data/
    LiveScreenDataPanel.tsx
    LiveVisionDataPanel.tsx
    StatusPanel.tsx
    CsvExportButton.tsx
  visualization/
    ThreeDVisualizationPanel.tsx
  recognizers/
    NumberRecognizer.ts
    MockRecognizer.ts
    TesseractRecognizer.ts
    CnnOnnxRecognizer.ts
  vision/
    VisionAnalyzer.ts
    MockVisionAnalyzer.ts
    ColorTrackingAnalyzer.ts
    TemplateMatchingAnalyzer.ts
    MarkerTrackingAnalyzer.ts
    OpticalFlowAnalyzer.ts
  utils/
    imagePreprocess.ts
    extractNumber.ts
    dataFilter.ts
    csvExport.ts
    cameraUtils.ts
    layoutStorage.ts
  store/
    useExperimentDataStore.ts
```

## 后续开发路线

### 接入真实 OCR

真实 OCR 已在 `src/recognizers/TesseractRecognizer.ts` 中接入 Tesseract.js。本项目已经准备了 ROI 裁剪、灰度化、对比度增强、二值化、放大、去噪和数字提取工具。当前限制字符白名单为：

```text
0123456789.-
```

只识别数字，不识别大段文字，并继续使用 `extractNumberFromText` 清洗 OCR 文本。后续可以继续增加阈值、反色、形态学去线、局部背景抑制等预处理选项。

### 接入 CNN / ONNX 数字识别

可以在 `src/recognizers/CnnOnnxRecognizer.ts` 中接入本地 ONNX Runtime Web 或轻量 CNN 模型。当前不训练模型、不增加复杂依赖；后续可基于朗威界面截图生成数字样本，训练一个只识别普通小数读数的轻量模型。建议保持完全本地推理，不调用云端 AI。

预留模型位置：

```text
src/assets/models/digit_recognizer.onnx
```

### 接入 Template Digit 模板识别

`template-digit` 适合朗威 DIS 这种固定字体、固定颜色、大号数字界面。后续可以采集 0-9、小数点和负号模板，做字符分割与模板匹配，可能比 Tesseract 更快、更稳定。

预留模板目录：

```text
src/assets/digit-templates/
  0.png
  1.png
  2.png
  3.png
  4.png
  5.png
  6.png
  7.png
  8.png
  9.png
  dot.png
  minus.png
```

建议模板采集方式：启动屏幕捕获后，把黄色 `ocrRoi` 精确框住单个数字或符号，导出对应截图，裁剪成紧贴字符边界的小图，并保持同一字号、颜色和背景处理方式。

### 接入真实摄像头视觉分析

可以分别在以下文件扩展算法：

- `ColorTrackingAnalyzer.ts`：颜色贴纸、光斑追踪；
- `TemplateMatchingAnalyzer.ts`：模板匹配；
- `MarkerTrackingAnalyzer.ts`：ArUco / AprilTag；
- `OpticalFlowAnalyzer.ts`：光流与运动估计。

后续可支持小车位移、滑块运动、轮子转动、弹簧振子、单摆、光斑振动、轨迹提取、角速度和置信度估计。

### 接入 Three.js / React Three Fiber

当前 `ThreeDVisualizationPanel.tsx` 是普通 div + CSS 的 3D 占位面板。后续可以在这里接入 three.js 或 React Three Fiber，将真实实验数据映射为小车、弹簧、单摆、转盘、光斑轨迹和力/速度/加速度矢量。

### 升级桌面透明悬浮版

如果要实现真正贴近“透明覆盖在实验软件上”的体验，建议将当前网页逻辑迁移到 Tauri 或 Electron：

- 窗口置顶；
- 半透明窗口；
- 局部透明；
- 鼠标穿透或局部可交互；
- 覆盖在原数字化实验软件窗口上方；
- 使用系统级截图或窗口捕获能力；
- 保留当前 React 组件和数据结构，替换底层采集适配层。

## 当前 mock 功能说明

当前版本不会调用大模型，不调用云端 AI。屏幕数字识别默认使用 `tesseract` 读取屏幕捕获画面中的黄色 `ocrRoi` 并进行本地 OCR；`mock` 仅作为 OCR 方案对比中的模拟对照。摄像头视觉分析除 mock 外仍是接口占位。
